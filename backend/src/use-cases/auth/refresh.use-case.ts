import { Inject, Injectable } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { RefreshTokenStatus } from '../../entities/refresh-token-status.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import { AuthSessionResult } from './auth-session-result';
import { REFRESH_TOKEN_TTL_SECONDS } from './auth.config';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import { RefreshTokenReusedError } from './errors/refresh-token-reused.error';
import {
  type IAuthAuditRepository,
  AUTH_AUDIT_REPOSITORY,
} from './ports/auth-audit-repository.port';
import { type IAuthUserRepository, AUTH_USER_REPOSITORY } from './ports/auth-user-repository.port';
import { type IIdGenerator, ID_GENERATOR } from './ports/id-generator.port';
import {
  type IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from './ports/refresh-token-repository.port';
import { type ITokenService, TOKEN_SERVICE } from './ports/token.port';

export type RefreshInput = { refreshToken: string | undefined };

/**
 * docs/specs/05-auth-login.md, criterios de aceptación backend 3, 4, 6.
 * Rota el refresh token en cada uso; si el `jti` presentado ya estaba rotado o
 * revocado, se interpreta como robo y se invalidan TODAS las sesiones activas
 * del usuario (docs/06-seguridad-global.md, apartado 6.2).
 *
 * Cada paso corre en su propia transacción: la revocación-por-reuso y los
 * distintos registros de auditoría deben sobrevivir aunque el método lance
 * justo después — si compartieran transacción con el `throw`, TypeORM haría
 * rollback también de esas escrituras (bug encontrado por el test de
 * integración, no reproducible con los fakes de los tests unitarios).
 */
@Injectable()
export class RefreshUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IIdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: RefreshInput): Promise<AuthSessionResult> {
    const now = this.clock.now();

    let payload;
    try {
      if (!input.refreshToken) {
        throw new Error('missing refresh token cookie');
      }
      payload = await this.tokenService.verifyRefreshToken(input.refreshToken);
    } catch {
      await this.unitOfWork.runInTransaction((ctx) =>
        this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.RefreshFailure,
            email: null,
            userId: null,
            companyId: null,
            result: AuthAuditResult.Failure,
            createdAt: now,
          },
          ctx,
        ),
      );
      throw new InvalidRefreshTokenError();
    }

    const record = await this.unitOfWork.runInTransaction((ctx) =>
      this.refreshTokenRepository.findById(payload.jti, ctx),
    );
    if (!record) {
      await this.unitOfWork.runInTransaction((ctx) =>
        this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.RefreshFailure,
            email: null,
            userId: payload.sub,
            companyId: payload.companyId,
            result: AuthAuditResult.Failure,
            createdAt: now,
          },
          ctx,
        ),
      );
      throw new InvalidRefreshTokenError();
    }

    if (record.status !== RefreshTokenStatus.Active) {
      await this.unitOfWork.runInTransaction(async (ctx) => {
        await this.refreshTokenRepository.revokeAllActiveForUser(record.userId, ctx);
        await this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.RefreshReuseDetected,
            email: null,
            userId: record.userId,
            companyId: payload.companyId,
            result: AuthAuditResult.Failure,
            metadata: { jti: payload.jti },
            createdAt: now,
          },
          ctx,
        );
      });
      throw new RefreshTokenReusedError();
    }

    const user = await this.unitOfWork.runInTransaction((ctx) =>
      this.authUserRepository.findByIdWithCompany(record.userId, ctx),
    );
    const isUsableAccount = user !== null && user.isActive && user.companyIsActive;
    if (!isUsableAccount) {
      await this.unitOfWork.runInTransaction((ctx) =>
        this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.RefreshFailure,
            email: user?.email ?? null,
            userId: record.userId,
            companyId: user?.companyId ?? null,
            result: AuthAuditResult.Failure,
            createdAt: now,
          },
          ctx,
        ),
      );
      throw new InvalidCredentialsError();
    }

    const newJti = this.idGenerator.generate();
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.refreshTokenRepository.markRotated(record.id, newJti, ctx);
      await this.refreshTokenRepository.create(
        { id: newJti, userId: user.id, expiresAt: refreshTokenExpiresAt, createdAt: now },
        ctx,
      );
    });

    // Se relee `role`/`companyId` desde `user` (recién consultado a DB), nunca del
    // payload del token viejo, para revalidar el alcance en cada renovación
    // (docs/06-seguridad-global.md, apartado 6.2, Regla 2).
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken({
        sub: user.id,
        email: user.email,
        companyId: user.companyId,
        role: user.role,
      }),
      this.tokenService.signRefreshToken({
        sub: user.id,
        companyId: user.companyId,
        role: user.role,
        jti: newJti,
      }),
    ]);

    await this.unitOfWork.runInTransaction((ctx) =>
      this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.RefreshSuccess,
          email: user.email,
          userId: user.id,
          companyId: user.companyId,
          result: AuthAuditResult.Success,
          createdAt: now,
        },
        ctx,
      ),
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: { id: user.id, email: user.email, role: user.role, companyId: user.companyId },
    };
  }
}

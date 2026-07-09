import { Inject, Injectable } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  type IPasswordHasher,
  PASSWORD_HASHER,
} from '../seed-demo-environment/ports/password-hasher.port';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import { AuthSessionResult } from './auth-session-result';
import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  MAX_LOGIN_FAILURES,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.config';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { TooManyLoginAttemptsError } from './errors/too-many-login-attempts.error';
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

export type LoginInput = { email: string; password: string };

/**
 * docs/specs/05-auth-login.md, criterios de aceptación backend 1, 2, 6, 7, 8.
 * Cada escritura corre en su propia transacción (en vez de una única transacción
 * para todo `execute`): un registro de auditoría de un intento fallido debe
 * sobrevivir aunque el propio método lance justo después — si compartiera la
 * transacción con el `throw`, TypeORM haría rollback también de la auditoría.
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(ID_GENERATOR) private readonly idGenerator: IIdGenerator,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: LoginInput): Promise<AuthSessionResult> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - LOGIN_FAILURE_WINDOW_MINUTES * 60_000);

    const recentFailures = await this.unitOfWork.runInTransaction((ctx) =>
      this.authAuditRepository.countRecentFailures(input.email, since, ctx),
    );
    if (recentFailures >= MAX_LOGIN_FAILURES) {
      await this.unitOfWork.runInTransaction((ctx) =>
        this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.LoginBlocked,
            email: input.email,
            userId: null,
            companyId: null,
            result: AuthAuditResult.Failure,
            createdAt: now,
          },
          ctx,
        ),
      );
      throw new TooManyLoginAttemptsError();
    }

    const user = await this.unitOfWork.runInTransaction((ctx) =>
      this.authUserRepository.findByEmailWithCompany(input.email, ctx),
    );
    const isUsableAccount = user !== null && user.isActive && user.companyIsActive;
    const passwordMatches =
      isUsableAccount && (await this.passwordHasher.compare(input.password, user.passwordHash));

    if (!isUsableAccount || !passwordMatches) {
      await this.unitOfWork.runInTransaction((ctx) =>
        this.authAuditRepository.record(
          {
            eventType: AuthAuditEventType.LoginFailure,
            email: input.email,
            userId: user?.id ?? null,
            companyId: user?.companyId ?? null,
            result: AuthAuditResult.Failure,
            createdAt: now,
          },
          ctx,
        ),
      );
      throw new InvalidCredentialsError();
    }

    const jti = this.idGenerator.generate();
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    await this.unitOfWork.runInTransaction((ctx) =>
      this.refreshTokenRepository.create(
        { id: jti, userId: user.id, expiresAt: refreshTokenExpiresAt, createdAt: now },
        ctx,
      ),
    );

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
        jti,
      }),
    ]);

    await this.unitOfWork.runInTransaction((ctx) =>
      this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.LoginSuccess,
          email: input.email,
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

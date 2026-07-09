import { Inject, Injectable } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { RefreshTokenStatus } from '../../entities/refresh-token-status.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import {
  type IAuthAuditRepository,
  AUTH_AUDIT_REPOSITORY,
} from './ports/auth-audit-repository.port';
import { type IAuthUserRepository, AUTH_USER_REPOSITORY } from './ports/auth-user-repository.port';
import {
  type IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from './ports/refresh-token-repository.port';
import { type ITokenService, TOKEN_SERVICE } from './ports/token.port';

export type LogoutInput = { refreshToken: string | undefined };

/**
 * docs/specs/05-auth-login.md, criterio de aceptación backend 5. Idempotente
 * y nunca lanza: identifica la sesión únicamente a partir del `refreshToken`
 * de la cookie (nunca de `req.user`), para que un `accessToken` ya expirado
 * no impida cerrar sesión — ver "Correcciones de contrato cruzado" del plan.
 */
@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: ITokenService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(input.refreshToken);
    } catch {
      return;
    }

    await this.unitOfWork.runInTransaction(async (ctx) => {
      const record = await this.refreshTokenRepository.findById(payload.jti, ctx);
      if (!record || record.status !== RefreshTokenStatus.Active) {
        return;
      }

      await this.refreshTokenRepository.revokeById(record.id, ctx);

      const user = await this.authUserRepository.findByIdWithCompany(record.userId, ctx);
      await this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.Logout,
          email: user?.email ?? null,
          userId: record.userId,
          companyId: user?.companyId ?? null,
          result: AuthAuditResult.Success,
          createdAt: this.clock.now(),
        },
        ctx,
      );
    });
  }
}

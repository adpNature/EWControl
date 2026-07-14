import { Inject, Injectable } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import {
  type IPasswordHasher,
  PASSWORD_HASHER,
} from '../seed-demo-environment/ports/password-hasher.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { CurrentPasswordInvalidError } from './errors/current-password-invalid.error';
import {
  type IAuthAuditRepository,
  AUTH_AUDIT_REPOSITORY,
} from './ports/auth-audit-repository.port';
import { type IAuthUserRepository, AUTH_USER_REPOSITORY } from './ports/auth-user-repository.port';
import {
  type IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from './ports/refresh-token-repository.port';

export type ChangePasswordInput = { userId: string; currentPassword: string; newPassword: string };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: cambio
 * de contraseña propio. Revoca todos los refresh tokens activos del usuario
 * (mismo `revokeAllActiveForUser` que la reutilización de refresh token en
 * docs/specs/05-auth-login.md) para forzar el re-login en el resto de
 * sesiones abiertas; el `accessToken` en memoria de la pestaña actual sigue
 * siendo válido hasta que expire de forma natural (≤15 min).
 */
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const now = this.clock.now();

    const user = await this.unitOfWork.runInTransaction((ctx) =>
      this.authUserRepository.findByIdWithCompany(input.userId, ctx),
    );
    const currentPasswordMatches =
      user !== null &&
      (await this.passwordHasher.compare(input.currentPassword, user.passwordHash));

    if (!user || !currentPasswordMatches) {
      throw new CurrentPasswordInvalidError();
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.authUserRepository.updatePasswordHash(user.id, newPasswordHash, ctx);
      await this.refreshTokenRepository.revokeAllActiveForUser(user.id, ctx);
      await this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.PasswordChange,
          email: user.email,
          userId: user.id,
          companyId: user.companyId,
          result: AuthAuditResult.Success,
          createdAt: now,
        },
        ctx,
      );
    });
  }
}

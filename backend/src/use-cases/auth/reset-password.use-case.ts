import { Inject, Injectable } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import {
  type IPasswordHasher,
  PASSWORD_HASHER,
} from '../seed-demo-environment/ports/password-hasher.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { InvalidResetTokenError } from './errors/invalid-reset-token.error';
import {
  type IAuthAuditRepository,
  AUTH_AUDIT_REPOSITORY,
} from './ports/auth-audit-repository.port';
import { type IAuthUserRepository, AUTH_USER_REPOSITORY } from './ports/auth-user-repository.port';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY,
} from './ports/password-reset-token-repository.port';
import {
  type IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from './ports/refresh-token-repository.port';

export type ResetPasswordInput = { token: string; newPassword: string };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: token
 * inválido/expirado/usado/huérfano responde siempre `InvalidResetTokenError`
 * (401), sin distinguir el motivo. En éxito, revoca todos los refresh tokens
 * activos (mismo `revokeAllActiveForUser` que `ChangePasswordUseCase`).
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const now = this.clock.now();

    const token = await this.unitOfWork.runInTransaction((ctx) =>
      this.passwordResetTokenRepository.findById(input.token, ctx),
    );
    const isTokenUsable = token !== null && token.usedAt === null && token.expiresAt > now;
    if (!isTokenUsable) {
      throw new InvalidResetTokenError();
    }

    const user = await this.unitOfWork.runInTransaction((ctx) =>
      this.authUserRepository.findByIdWithCompany(token.userId, ctx),
    );
    if (!user) {
      throw new InvalidResetTokenError();
    }

    const newPasswordHash = await this.passwordHasher.hash(input.newPassword);
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.authUserRepository.updatePasswordHash(user.id, newPasswordHash, ctx);
      await this.passwordResetTokenRepository.markUsed(token.id, now, ctx);
      await this.refreshTokenRepository.revokeAllActiveForUser(user.id, ctx);
      await this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.PasswordResetSuccess,
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

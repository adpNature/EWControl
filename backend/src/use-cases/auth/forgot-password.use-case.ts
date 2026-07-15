import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { buildPasswordResetEmail } from './build-password-reset-email';
import {
  FORGOT_PASSWORD_WINDOW_MINUTES,
  MAX_FORGOT_PASSWORD_REQUESTS,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
} from './auth.config';
import { TooManyPasswordResetRequestsError } from './errors/too-many-password-reset-requests.error';
import {
  type IAuthAuditRepository,
  AUTH_AUDIT_REPOSITORY,
} from './ports/auth-audit-repository.port';
import { type IAuthUserRepository, AUTH_USER_REPOSITORY } from './ports/auth-user-repository.port';
import { FRONTEND_BASE_URL } from './ports/frontend-base-url.token';
import { type IIdGenerator, ID_GENERATOR } from './ports/id-generator.port';
import {
  type IPasswordResetTokenRepository,
  PASSWORD_RESET_TOKEN_REPOSITORY,
} from './ports/password-reset-token-repository.port';
import { EMAIL_SENDER, type IEmailSender } from '../notification/ports/email-sender.port';

export type ForgotPasswordInput = { email: string };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: siempre
 * resuelve sin lanzar (el controller responde `202` igual exista o no el
 * email), salvo el propio rate limit — mismo criterio de "nunca confirmar
 * existencia" que `INVALID_CREDENTIALS` en login (OWASP A07). El envío de
 * email nunca relanza (mismo patrón que `NotifyAlarmTriggeredUseCase`).
 */
@Injectable()
export class ForgotPasswordUseCase {
  private readonly logger = new Logger(ForgotPasswordUseCase.name);

  constructor(
    @Inject(AUTH_USER_REPOSITORY) private readonly authUserRepository: IAuthUserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
    @Inject(AUTH_AUDIT_REPOSITORY) private readonly authAuditRepository: IAuthAuditRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
    @Inject(ID_GENERATOR) private readonly idGenerator: IIdGenerator,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(FRONTEND_BASE_URL) private readonly frontendBaseUrl: string,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - FORGOT_PASSWORD_WINDOW_MINUTES * 60_000);

    const recentRequests = await this.unitOfWork.runInTransaction((ctx) =>
      this.authAuditRepository.countRecentByEmailAndType(
        input.email,
        AuthAuditEventType.PasswordResetRequested,
        since,
        ctx,
      ),
    );
    if (recentRequests >= MAX_FORGOT_PASSWORD_REQUESTS) {
      throw new TooManyPasswordResetRequestsError();
    }

    await this.unitOfWork.runInTransaction((ctx) =>
      this.authAuditRepository.record(
        {
          eventType: AuthAuditEventType.PasswordResetRequested,
          email: input.email,
          userId: null,
          companyId: null,
          result: AuthAuditResult.Success,
          createdAt: now,
        },
        ctx,
      ),
    );

    const user = await this.unitOfWork.runInTransaction((ctx) =>
      this.authUserRepository.findByEmailWithCompany(input.email, ctx),
    );
    const isUsableAccount = user !== null && user.isActive && user.companyIsActive;
    if (!isUsableAccount) {
      return;
    }

    const token = this.idGenerator.generate();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);
    await this.unitOfWork.runInTransaction((ctx) =>
      this.passwordResetTokenRepository.create(
        { id: token, userId: user.id, expiresAt, createdAt: now },
        ctx,
      ),
    );

    const resetUrl = `${this.frontendBaseUrl}/reset-password?token=${token}`;
    const email = buildPasswordResetEmail({ resetUrl });
    try {
      await this.emailSender.send({ to: [user.email], subject: email.subject, text: email.text });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el email de recuperación de contraseña a ${user.email}: ${(error as Error).message}`,
      );
    }
  }
}

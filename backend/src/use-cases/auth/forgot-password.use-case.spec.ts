import { describe, expect, it, vi } from 'vitest';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { ForgotPasswordUseCase } from './forgot-password.use-case';
import { TooManyPasswordResetRequestsError } from './errors/too-many-password-reset-requests.error';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-14T12:00:00Z');
const USABLE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  passwordHash: 'hashed',
  role: 'AdminCliente',
  companyId: 'company-1',
  isActive: true,
  companyIsActive: true,
};

function createFakes() {
  const authUserRepository = {
    findByEmailWithCompany: vi.fn().mockResolvedValue(USABLE_USER),
    findByIdWithCompany: vi.fn(),
    updatePasswordHash: vi.fn(),
  };
  const passwordResetTokenRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    markUsed: vi.fn(),
  };
  const authAuditRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    countRecentFailures: vi.fn(),
    countRecentByEmailAndType: vi.fn().mockResolvedValue(0),
  };
  const emailSender = { send: vi.fn().mockResolvedValue(undefined) };
  const idGenerator = { generate: vi.fn().mockReturnValue('reset-token-1') };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    authUserRepository,
    passwordResetTokenRepository,
    authAuditRepository,
    emailSender,
    idGenerator,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ForgotPasswordUseCase(
    fakes.authUserRepository,
    fakes.passwordResetTokenRepository,
    fakes.authAuditRepository,
    fakes.emailSender,
    fakes.idGenerator,
    fakes.unitOfWork,
    fakes.clock,
    'http://localhost:4200',
  );
}

describe('ForgotPasswordUseCase', () => {
  it('genera un token, lo persiste y envía el email cuando el User es usable', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ email: 'demo@ewcontrol.local' });

    expect(fakes.passwordResetTokenRepository.create).toHaveBeenCalledWith(
      {
        id: 'reset-token-1',
        userId: 'user-1',
        expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        createdAt: NOW,
      },
      FAKE_CTX,
    );
    expect(fakes.emailSender.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['demo@ewcontrol.local'],
        text: expect.stringContaining('http://localhost:4200/reset-password?token=reset-token-1'),
      }),
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.PasswordResetRequested,
        email: 'demo@ewcontrol.local',
        result: AuthAuditResult.Success,
      }),
      FAKE_CTX,
    );
  });

  it('no envía ningún email si el User no existe, sin lanzar error (evita enumeración)', async () => {
    const fakes = createFakes();
    fakes.authUserRepository.findByEmailWithCompany.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: 'inexistente@ewcontrol.local' }),
    ).resolves.toBeUndefined();

    expect(fakes.passwordResetTokenRepository.create).not.toHaveBeenCalled();
    expect(fakes.emailSender.send).not.toHaveBeenCalled();
  });

  it('no envía ningún email si el User está inactivo o su Company está inactiva', async () => {
    const fakes = createFakes();
    fakes.authUserRepository.findByEmailWithCompany.mockResolvedValue({
      ...USABLE_USER,
      isActive: false,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({ email: 'demo@ewcontrol.local' });

    expect(fakes.emailSender.send).not.toHaveBeenCalled();
  });

  it('lanza TooManyPasswordResetRequestsError si ya hubo 3 solicitudes en la ventana, sin buscar el usuario', async () => {
    const fakes = createFakes();
    fakes.authAuditRepository.countRecentByEmailAndType.mockResolvedValue(3);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ email: 'demo@ewcontrol.local' })).rejects.toBeInstanceOf(
      TooManyPasswordResetRequestsError,
    );
    expect(fakes.authUserRepository.findByEmailWithCompany).not.toHaveBeenCalled();
  });

  it('no relanza si el envío de email falla', async () => {
    const fakes = createFakes();
    fakes.emailSender.send.mockRejectedValue(new Error('SMTP down'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ email: 'demo@ewcontrol.local' })).resolves.toBeUndefined();
  });
});

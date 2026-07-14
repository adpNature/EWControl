import { describe, expect, it, vi } from 'vitest';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { InvalidResetTokenError } from './errors/invalid-reset-token.error';
import { ResetPasswordUseCase } from './reset-password.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-14T12:00:00Z');
const VALID_TOKEN = {
  id: 'reset-token-1',
  userId: 'user-1',
  expiresAt: new Date('2026-07-14T12:30:00Z'),
  usedAt: null,
};

function createFakes() {
  const passwordResetTokenRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(VALID_TOKEN),
    markUsed: vi.fn().mockResolvedValue(undefined),
  };
  const authUserRepository = {
    findByEmailWithCompany: vi.fn(),
    findByIdWithCompany: vi
      .fn()
      .mockResolvedValue({ id: 'user-1', email: 'demo@ewcontrol.local', companyId: 'company-1' }),
    updatePasswordHash: vi.fn().mockResolvedValue(undefined),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    markRotated: vi.fn(),
    revokeById: vi.fn(),
    revokeAllActiveForUser: vi.fn(),
  };
  const authAuditRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    countRecentFailures: vi.fn(),
    countRecentByEmailAndType: vi.fn(),
  };
  const passwordHasher = { hash: vi.fn().mockResolvedValue('hashed:new'), compare: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    passwordResetTokenRepository,
    authUserRepository,
    refreshTokenRepository,
    authAuditRepository,
    passwordHasher,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ResetPasswordUseCase(
    fakes.passwordResetTokenRepository,
    fakes.authUserRepository,
    fakes.refreshTokenRepository,
    fakes.authAuditRepository,
    fakes.passwordHasher,
    fakes.unitOfWork,
    fakes.clock,
  );
}

describe('ResetPasswordUseCase', () => {
  it('actualiza la contraseña, marca el token usado y revoca los refresh tokens activos', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ token: 'reset-token-1', newPassword: 'Nueva1234!' });

    expect(fakes.passwordHasher.hash).toHaveBeenCalledWith('Nueva1234!');
    expect(fakes.authUserRepository.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      'hashed:new',
      FAKE_CTX,
    );
    expect(fakes.passwordResetTokenRepository.markUsed).toHaveBeenCalledWith(
      'reset-token-1',
      NOW,
      FAKE_CTX,
    );
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).toHaveBeenCalledWith(
      'user-1',
      FAKE_CTX,
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.PasswordResetSuccess,
        userId: 'user-1',
        result: AuthAuditResult.Success,
      }),
      FAKE_CTX,
    );
  });

  it('lanza InvalidResetTokenError si el token no existe', async () => {
    const fakes = createFakes();
    fakes.passwordResetTokenRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ token: 'missing', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
    expect(fakes.authUserRepository.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('lanza InvalidResetTokenError si el token ya fue usado', async () => {
    const fakes = createFakes();
    fakes.passwordResetTokenRepository.findById.mockResolvedValue({
      ...VALID_TOKEN,
      usedAt: new Date('2026-07-14T11:00:00Z'),
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ token: 'reset-token-1', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('lanza InvalidResetTokenError si el token está expirado', async () => {
    const fakes = createFakes();
    fakes.passwordResetTokenRepository.findById.mockResolvedValue({
      ...VALID_TOKEN,
      expiresAt: new Date('2026-07-14T11:00:00Z'),
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ token: 'reset-token-1', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('lanza InvalidResetTokenError si el User del token ya no existe', async () => {
    const fakes = createFakes();
    fakes.authUserRepository.findByIdWithCompany.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ token: 'reset-token-1', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });
});

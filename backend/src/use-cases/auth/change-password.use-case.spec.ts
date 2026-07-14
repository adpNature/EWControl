import { describe, expect, it, vi } from 'vitest';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { ChangePasswordUseCase } from './change-password.use-case';
import { CurrentPasswordInvalidError } from './errors/current-password-invalid.error';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-14T12:00:00Z');
const AUTH_USER_RECORD = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  passwordHash: 'hashed:current',
  role: 'AdminCliente',
  companyId: 'company-1',
  isActive: true,
  companyIsActive: true,
};

function createFakes() {
  const authUserRepository = {
    findByEmailWithCompany: vi.fn(),
    findByIdWithCompany: vi.fn().mockResolvedValue(AUTH_USER_RECORD),
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
  };
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue('hashed:new'),
    compare: vi.fn().mockResolvedValue(true),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return {
    authUserRepository,
    refreshTokenRepository,
    authAuditRepository,
    passwordHasher,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ChangePasswordUseCase(
    fakes.authUserRepository,
    fakes.refreshTokenRepository,
    fakes.authAuditRepository,
    fakes.passwordHasher,
    fakes.unitOfWork,
    fakes.clock,
  );
}

describe('ChangePasswordUseCase', () => {
  it('actualiza el hash, revoca los refresh tokens activos y audita el éxito', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      userId: 'user-1',
      currentPassword: 'Demo1234!',
      newPassword: 'Nueva1234!',
    });

    expect(fakes.passwordHasher.compare).toHaveBeenCalledWith('Demo1234!', 'hashed:current');
    expect(fakes.passwordHasher.hash).toHaveBeenCalledWith('Nueva1234!');
    expect(fakes.authUserRepository.updatePasswordHash).toHaveBeenCalledWith(
      'user-1',
      'hashed:new',
      FAKE_CTX,
    );
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).toHaveBeenCalledWith(
      'user-1',
      FAKE_CTX,
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      {
        eventType: AuthAuditEventType.PasswordChange,
        email: 'demo@ewcontrol.local',
        userId: 'user-1',
        companyId: 'company-1',
        result: AuthAuditResult.Success,
        createdAt: NOW,
      },
      FAKE_CTX,
    );
  });

  it('lanza CurrentPasswordInvalidError si la contraseña actual no coincide, sin escribir nada', async () => {
    const fakes = createFakes();
    fakes.passwordHasher.compare.mockResolvedValue(false);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ userId: 'user-1', currentPassword: 'mala', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(CurrentPasswordInvalidError);

    expect(fakes.authUserRepository.updatePasswordHash).not.toHaveBeenCalled();
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).not.toHaveBeenCalled();
  });

  it('lanza CurrentPasswordInvalidError si el User no existe', async () => {
    const fakes = createFakes();
    fakes.authUserRepository.findByIdWithCompany.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ userId: 'missing', currentPassword: 'x', newPassword: 'Nueva1234!' }),
    ).rejects.toBeInstanceOf(CurrentPasswordInvalidError);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { RefreshTokenStatus } from '../../entities/refresh-token-status.enum';
import { LogoutUseCase } from './logout.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const JTI = 'jti-1';
const PAYLOAD = { sub: 'user-1', companyId: 'company-1', role: UserRole.AdminCliente, jti: JTI };

function createFakes() {
  const authUserRepository = {
    findByEmailWithCompany: vi.fn(),
    findByIdWithCompany: vi.fn().mockResolvedValue({
      id: 'user-1',
      email: 'demo@ewcontrol.local',
      passwordHash: 'hash',
      role: UserRole.AdminCliente,
      companyId: 'company-1',
      isActive: true,
      companyIsActive: true,
    }),
  };
  const refreshTokenRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: JTI,
      userId: 'user-1',
      status: RefreshTokenStatus.Active,
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
    }),
    markRotated: vi.fn(),
    revokeById: vi.fn().mockResolvedValue(undefined),
    revokeAllActiveForUser: vi.fn(),
  };
  const authAuditRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    countRecentFailures: vi.fn(),
  };
  const tokenService = {
    signAccessToken: vi.fn(),
    signRefreshToken: vi.fn(),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn().mockResolvedValue(PAYLOAD),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(new Date('2026-07-09T12:00:00.000Z')) };

  return {
    authUserRepository,
    refreshTokenRepository,
    authAuditRepository,
    tokenService,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new LogoutUseCase(
    fakes.authUserRepository,
    fakes.refreshTokenRepository,
    fakes.authAuditRepository,
    fakes.tokenService,
    fakes.unitOfWork as never,
    fakes.clock,
  );
}

describe('LogoutUseCase', () => {
  let fakes: ReturnType<typeof createFakes>;

  beforeEach(() => {
    fakes = createFakes();
  });

  it('con un refresh token activo lo revoca y audita el logout', async () => {
    const useCase = createUseCase(fakes);

    await useCase.execute({ refreshToken: 'valid-refresh-jwt' });

    expect(fakes.refreshTokenRepository.revokeById).toHaveBeenCalledWith(JTI, FAKE_CTX);
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.Logout, userId: 'user-1' }),
      FAKE_CTX,
    );
  });

  it('sin refresh token es un no-op y no lanza', async () => {
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: undefined })).resolves.toBeUndefined();
    expect(fakes.refreshTokenRepository.revokeById).not.toHaveBeenCalled();
  });

  it('con un refresh token de firma inválida no lanza y no revoca nada', async () => {
    fakes.tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad signature'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'garbage' })).resolves.toBeUndefined();
    expect(fakes.refreshTokenRepository.revokeById).not.toHaveBeenCalled();
  });

  it('es idempotente: si el token ya estaba revocado, la segunda llamada no lanza ni revoca de nuevo', async () => {
    fakes.refreshTokenRepository.findById.mockResolvedValue({
      id: JTI,
      userId: 'user-1',
      status: RefreshTokenStatus.Revoked,
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
    });
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'valid-refresh-jwt' })).resolves.toBeUndefined();
    expect(fakes.refreshTokenRepository.revokeById).not.toHaveBeenCalled();
  });
});

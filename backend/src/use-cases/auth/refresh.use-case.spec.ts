import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { RefreshTokenStatus } from '../../entities/refresh-token-status.enum';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from './errors/invalid-refresh-token.error';
import { RefreshTokenReusedError } from './errors/refresh-token-reused.error';
import { RefreshUseCase } from './refresh.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-09T12:00:00.000Z');

const OLD_JTI = 'jti-old';
const PAYLOAD = {
  sub: 'user-1',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
  jti: OLD_JTI,
};

const AUTH_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  passwordHash: 'hashed:Demo1234!',
  role: UserRole.AdminCliente,
  companyId: 'company-1',
  isActive: true,
  companyIsActive: true,
};

function createFakes() {
  const authUserRepository = {
    findByEmailWithCompany: vi.fn(),
    findByIdWithCompany: vi.fn().mockResolvedValue(AUTH_USER),
  };
  const refreshTokenRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue({
      id: OLD_JTI,
      userId: 'user-1',
      status: RefreshTokenStatus.Active,
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
    }),
    markRotated: vi.fn().mockResolvedValue(undefined),
    revokeById: vi.fn(),
    revokeAllActiveForUser: vi.fn().mockResolvedValue(undefined),
  };
  const authAuditRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    countRecentFailures: vi.fn(),
  };
  const tokenService = {
    signAccessToken: vi.fn().mockResolvedValue('new-access-token'),
    signRefreshToken: vi.fn().mockResolvedValue('new-refresh-token'),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn().mockResolvedValue(PAYLOAD),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('jti-new') };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };

  return {
    authUserRepository,
    refreshTokenRepository,
    authAuditRepository,
    tokenService,
    idGenerator,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new RefreshUseCase(
    fakes.authUserRepository,
    fakes.refreshTokenRepository,
    fakes.authAuditRepository,
    fakes.tokenService,
    fakes.idGenerator,
    fakes.unitOfWork as never,
    fakes.clock,
  );
}

describe('RefreshUseCase', () => {
  let fakes: ReturnType<typeof createFakes>;

  beforeEach(() => {
    fakes = createFakes();
  });

  it('con un refresh token activo rota: marca el viejo como rotado y crea uno nuevo', async () => {
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ refreshToken: 'old-refresh-jwt' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(fakes.refreshTokenRepository.markRotated).toHaveBeenCalledWith(
      OLD_JTI,
      'jti-new',
      FAKE_CTX,
    );
    expect(fakes.refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jti-new', userId: AUTH_USER.id }),
      FAKE_CTX,
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.RefreshSuccess }),
      FAKE_CTX,
    );
  });

  it('firma el nuevo access token con role/companyId releídos de DB, no del payload del token viejo', async () => {
    fakes.authUserRepository.findByIdWithCompany.mockResolvedValue({
      ...AUTH_USER,
      role: UserRole.SuperAdmin,
      companyId: 'company-2',
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({ refreshToken: 'old-refresh-jwt' });

    expect(fakes.tokenService.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.SuperAdmin, companyId: 'company-2' }),
    );
  });

  it('con firma inválida/caducada lanza InvalidRefreshTokenError', async () => {
    fakes.tokenService.verifyRefreshToken.mockRejectedValue(new Error('bad signature'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'garbage' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
    expect(fakes.refreshTokenRepository.findById).not.toHaveBeenCalled();
  });

  it('si el jti no existe en DB lanza InvalidRefreshTokenError', async () => {
    fakes.refreshTokenRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'old-refresh-jwt' })).rejects.toBeInstanceOf(
      InvalidRefreshTokenError,
    );
  });

  it('si el token ya estaba rotado, detecta reuso: revoca todas las sesiones del usuario', async () => {
    fakes.refreshTokenRepository.findById.mockResolvedValue({
      id: OLD_JTI,
      userId: 'user-1',
      status: RefreshTokenStatus.Rotated,
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
    });
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'old-refresh-jwt' })).rejects.toBeInstanceOf(
      RefreshTokenReusedError,
    );
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).toHaveBeenCalledWith(
      'user-1',
      FAKE_CTX,
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.RefreshReuseDetected }),
      FAKE_CTX,
    );
    expect(fakes.refreshTokenRepository.markRotated).not.toHaveBeenCalled();
  });

  it('si el token ya estaba revocado, también lo trata como reuso', async () => {
    fakes.refreshTokenRepository.findById.mockResolvedValue({
      id: OLD_JTI,
      userId: 'user-1',
      status: RefreshTokenStatus.Revoked,
      expiresAt: new Date('2026-07-16T12:00:00.000Z'),
    });
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'old-refresh-jwt' })).rejects.toBeInstanceOf(
      RefreshTokenReusedError,
    );
  });

  it('si el User quedó desactivado tras emitir el token, lanza InvalidCredentialsError sin rotar', async () => {
    fakes.authUserRepository.findByIdWithCompany.mockResolvedValue({
      ...AUTH_USER,
      isActive: false,
    });
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'old-refresh-jwt' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
    expect(fakes.refreshTokenRepository.markRotated).not.toHaveBeenCalled();
  });

  it('si la Company del usuario quedó desactivada, lanza InvalidCredentialsError', async () => {
    fakes.authUserRepository.findByIdWithCompany.mockResolvedValue({
      ...AUTH_USER,
      companyIsActive: false,
    });
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ refreshToken: 'old-refresh-jwt' })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });
});

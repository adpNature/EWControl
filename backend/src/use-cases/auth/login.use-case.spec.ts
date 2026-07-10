import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AuthAuditEventType } from '../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../entities/auth-audit-result.enum';
import { InvalidCredentialsError } from './errors/invalid-credentials.error';
import { TooManyLoginAttemptsError } from './errors/too-many-login-attempts.error';
import { LoginUseCase } from './login.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-09T12:00:00.000Z');

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
    findByEmailWithCompany: vi.fn().mockResolvedValue(AUTH_USER),
    findByIdWithCompany: vi.fn(),
  };
  const refreshTokenRepository = {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn(),
    markRotated: vi.fn(),
    revokeById: vi.fn(),
    revokeAllActiveForUser: vi.fn(),
  };
  const authAuditRepository = {
    record: vi.fn().mockResolvedValue(undefined),
    countRecentFailures: vi.fn().mockResolvedValue(0),
  };
  const tokenService = {
    signAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: vi.fn(),
  };
  const idGenerator = { generate: vi.fn().mockReturnValue('jti-1') };
  const passwordHasher = { hash: vi.fn(), compare: vi.fn().mockResolvedValue(true) };
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
    passwordHasher,
    unitOfWork,
    clock,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new LoginUseCase(
    fakes.authUserRepository,
    fakes.refreshTokenRepository,
    fakes.authAuditRepository,
    fakes.tokenService,
    fakes.idGenerator,
    fakes.passwordHasher,
    fakes.unitOfWork as never,
    fakes.clock,
  );
}

describe('LoginUseCase', () => {
  let fakes: ReturnType<typeof createFakes>;

  beforeEach(() => {
    fakes = createFakes();
  });

  it('con credenciales válidas devuelve access+refresh token, persiste el refresh token y audita éxito', async () => {
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user).toEqual({
      id: AUTH_USER.id,
      email: AUTH_USER.email,
      role: AUTH_USER.role,
      companyId: AUTH_USER.companyId,
    });

    expect(fakes.tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: AUTH_USER.id,
      email: AUTH_USER.email,
      companyId: AUTH_USER.companyId,
      role: AUTH_USER.role,
    });
    expect(fakes.refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'jti-1', userId: AUTH_USER.id }),
      FAKE_CTX,
    );
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.LoginSuccess,
        result: AuthAuditResult.Success,
        userId: AUTH_USER.id,
      }),
      FAKE_CTX,
    );
  });

  it('con un email inexistente lanza InvalidCredentialsError y audita el fallo sin userId', async () => {
    fakes.authUserRepository.findByEmailWithCompany.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: 'ghost@ewcontrol.local', password: 'whatever' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AuthAuditEventType.LoginFailure,
        userId: null,
        companyId: null,
      }),
      FAKE_CTX,
    );
    expect(fakes.refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('con password incorrecta lanza InvalidCredentialsError (mismo tipo que email inexistente)', async () => {
    fakes.passwordHasher.compare.mockResolvedValue(false);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: AUTH_USER.email, password: 'wrong' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.LoginFailure, userId: AUTH_USER.id }),
      FAKE_CTX,
    );
  });

  it('con un User desactivado lanza InvalidCredentialsError sin llegar a comparar la contraseña', async () => {
    fakes.authUserRepository.findByEmailWithCompany.mockResolvedValue({
      ...AUTH_USER,
      isActive: false,
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    expect(fakes.passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('con la Company desactivada lanza InvalidCredentialsError', async () => {
    fakes.authUserRepository.findByEmailWithCompany.mockResolvedValue({
      ...AUTH_USER,
      companyIsActive: false,
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('bloquea con TooManyLoginAttemptsError al superar 5 fallos recientes, sin comparar password', async () => {
    fakes.authAuditRepository.countRecentFailures.mockResolvedValue(5);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' }),
    ).rejects.toBeInstanceOf(TooManyLoginAttemptsError);

    expect(fakes.passwordHasher.compare).not.toHaveBeenCalled();
    expect(fakes.authAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.LoginBlocked }),
      FAKE_CTX,
    );
  });

  it('con 4 fallos recientes (por debajo del límite) permite continuar el login normalmente', async () => {
    fakes.authAuditRepository.countRecentFailures.mockResolvedValue(4);
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' });

    expect(result.accessToken).toBe('access-token');
  });

  it('propaga el error sin auditar éxito si falla la persistencia del refresh token', async () => {
    const failure = new Error('db down');
    fakes.refreshTokenRepository.create.mockRejectedValue(failure);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ email: AUTH_USER.email, password: 'Demo1234!' })).rejects.toBe(
      failure,
    );
    expect(fakes.authAuditRepository.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AuthAuditEventType.LoginSuccess }),
      expect.anything(),
    );
  });
});

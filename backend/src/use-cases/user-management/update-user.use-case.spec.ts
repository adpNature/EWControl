import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { CannotCreateSuperAdminError } from './errors/cannot-create-superadmin.error';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { UpdateUserUseCase } from './update-user.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const USER = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'demo@ewcontrol.local',
  role: UserRole.AdminCliente,
  isActive: true,
};

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(USER) };
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...USER, email: 'nuevo@ewcontrol.local' }),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const refreshTokenRepository = { revokeAllActiveForUser: vi.fn().mockResolvedValue(undefined) };
  return { resolver, userRepository, refreshTokenRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new UpdateUserUseCase(
    fakes.resolver as never,
    fakes.userRepository,
    fakes.refreshTokenRepository as never,
    fakes.unitOfWork,
  );
}

describe('UpdateUserUseCase', () => {
  it('actualiza el email de un User existente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    const result = await useCase.execute({
      userId: 'user-1',
      requester,
      email: 'nuevo@ewcontrol.local',
    });

    expect(fakes.userRepository.update).toHaveBeenCalledWith(
      'user-1',
      { email: 'nuevo@ewcontrol.local' },
      FAKE_CTX,
    );
    expect(result.email).toBe('nuevo@ewcontrol.local');
  });

  it('lanza EmailAlreadyExistsError si el nuevo email ya lo usa otro User', async () => {
    const fakes = createFakes();
    fakes.userRepository.findByEmail.mockResolvedValue({ id: 'other-user' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        userId: 'user-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        email: 'ya-existe@ewcontrol.local',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    expect(fakes.userRepository.update).not.toHaveBeenCalled();
  });

  it('lanza CannotCreateSuperAdminError si un AdminCliente intenta ascender a SuperAdmin', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        userId: 'user-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        role: UserRole.SuperAdmin,
      }),
    ).rejects.toBeInstanceOf(CannotCreateSuperAdminError);
    expect(fakes.userRepository.update).not.toHaveBeenCalled();
  });

  it('un SuperAdmin sí puede ascender a otro User a SuperAdmin', async () => {
    const fakes = createFakes();
    fakes.userRepository.update.mockResolvedValue({ ...USER, role: UserRole.SuperAdmin });
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      userId: 'user-1',
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      role: UserRole.SuperAdmin,
    });

    expect(result.role).toBe(UserRole.SuperAdmin);
  });

  it('un AdminCliente puede pasar un User a Operador y se revocan sus sesiones (spec 19, criterio 6)', async () => {
    const fakes = createFakes();
    fakes.userRepository.update.mockResolvedValue({ ...USER, role: UserRole.Operador });
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      userId: 'user-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      role: UserRole.Operador,
    });

    expect(result.role).toBe(UserRole.Operador);
    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).toHaveBeenCalledWith(
      'user-1',
      FAKE_CTX,
    );
  });

  it('no revoca sesiones si el rol no cambia o no se envía', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    await useCase.execute({ userId: 'user-1', requester, email: 'nuevo@ewcontrol.local' });
    await useCase.execute({ userId: 'user-1', requester, role: UserRole.AdminCliente });

    expect(fakes.refreshTokenRepository.revokeAllActiveForUser).not.toHaveBeenCalled();
  });
});

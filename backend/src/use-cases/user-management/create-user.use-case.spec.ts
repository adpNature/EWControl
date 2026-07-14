import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { CannotCreateSuperAdminError } from './errors/cannot-create-superadmin.error';
import { CompanyIdRequiredError } from './errors/company-id-required.error';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';
import { CreateUserUseCase } from './create-user.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const HASHED_PASSWORD = 'hashed:Demo1234!';

function createFakes() {
  const userRepository = {
    create: vi.fn().mockResolvedValue({ id: 'user-1', companyId: 'company-1' }),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  const passwordHasher = {
    hash: vi.fn().mockResolvedValue(HASHED_PASSWORD),
    compare: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { userRepository, passwordHasher, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateUserUseCase(fakes.userRepository, fakes.passwordHasher, fakes.unitOfWork);
}

describe('CreateUserUseCase', () => {
  it('un AdminCliente crea un User en su propia Company, ignorando cualquier companyId del input', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      companyId: 'other-company',
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });

    expect(fakes.userRepository.create).toHaveBeenCalledWith(
      {
        companyId: 'company-1',
        email: 'nuevo@ewcontrol.local',
        passwordHash: HASHED_PASSWORD,
        role: UserRole.AdminCliente,
      },
      FAKE_CTX,
    );
  });

  it('un SuperAdmin crea un User en la Company indicada explícitamente en el input', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'requester-company', role: UserRole.SuperAdmin },
      companyId: 'target-company',
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });

    expect(fakes.userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'target-company' }),
      FAKE_CTX,
    );
  });

  it('lanza CompanyIdRequiredError si el SuperAdmin no indica companyId', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        requester: { companyId: 'requester-company', role: UserRole.SuperAdmin },
        email: 'nuevo@ewcontrol.local',
        password: 'Demo1234!',
        role: UserRole.AdminCliente,
      }),
    ).rejects.toBeInstanceOf(CompanyIdRequiredError);
    expect(fakes.userRepository.create).not.toHaveBeenCalled();
  });

  it('lanza CannotCreateSuperAdminError si un AdminCliente intenta crear un SuperAdmin', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        email: 'nuevo@ewcontrol.local',
        password: 'Demo1234!',
        role: UserRole.SuperAdmin,
      }),
    ).rejects.toBeInstanceOf(CannotCreateSuperAdminError);
    expect(fakes.userRepository.create).not.toHaveBeenCalled();
  });

  it('lanza EmailAlreadyExistsError si el email ya existe en cualquier Company', async () => {
    const fakes = createFakes();
    fakes.userRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        email: 'ya-existe@ewcontrol.local',
        password: 'Demo1234!',
        role: UserRole.AdminCliente,
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    expect(fakes.userRepository.create).not.toHaveBeenCalled();
  });

  it('nunca almacena la contraseña en texto plano', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: UserRole.AdminCliente,
    });

    const [userData] = fakes.userRepository.create.mock.calls[0];
    expect(userData.passwordHash).toBe(HASHED_PASSWORD);
    expect(userData.passwordHash).not.toBe('Demo1234!');
  });
});

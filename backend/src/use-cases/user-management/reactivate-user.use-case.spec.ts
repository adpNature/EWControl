import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { UserNotFoundError } from './errors/user-not-found.error';
import { ReactivateUserUseCase } from './reactivate-user.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const USER = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'demo@ewcontrol.local',
  role: UserRole.AdminCliente,
  isActive: false,
};

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(USER) };
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn().mockResolvedValue({ ...USER, isActive: true }),
    deleteAllByCompanyId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, userRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ReactivateUserUseCase(fakes.resolver as never, fakes.userRepository, fakes.unitOfWork);
}

describe('ReactivateUserUseCase', () => {
  it('marca el User como activo', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    await useCase.execute({ userId: 'user-1', requester });

    expect(fakes.resolver.resolveAny).toHaveBeenCalledWith('user-1', requester, FAKE_CTX);
    expect(fakes.userRepository.reactivate).toHaveBeenCalledWith('user-1', FAKE_CTX);
  });

  it('propaga UserNotFoundError del resolver (otra Company o inexistente)', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockRejectedValue(new UserNotFoundError('missing'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        userId: 'missing',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
    expect(fakes.userRepository.reactivate).not.toHaveBeenCalled();
  });
});

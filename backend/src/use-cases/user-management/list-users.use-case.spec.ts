import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { ListUsersUseCase } from './list-users.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [{ id: 'user-1' }], total: 1 }),
    update: vi.fn(),
    deactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { userRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ListUsersUseCase(fakes.userRepository, fakes.unitOfWork);
}

describe('ListUsersUseCase', () => {
  it('filtra por la Company del requester cuando es AdminCliente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.userRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
    expect(result).toEqual({ data: [{ id: 'user-1' }], total: 1, limit: 20, offset: 0 });
  });

  it('no filtra por Company cuando el requester es SuperAdmin y no indica companyId', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.userRepository.list).toHaveBeenCalledWith(
      { companyId: null, isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('un SuperAdmin puede acotar el listado a una Company concreta (switcher)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      companyId: 'company-2',
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.userRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-2', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('ignora companyId del input cuando el requester es AdminCliente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      companyId: 'other-company',
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.userRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });
});

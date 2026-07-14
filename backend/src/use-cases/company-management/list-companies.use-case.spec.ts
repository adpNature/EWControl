import { describe, expect, it, vi } from 'vitest';
import { ListCompaniesUseCase } from './list-companies.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [{ id: 'company-1' }], total: 1 }),
    update: vi.fn(),
    deactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { companyRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ListCompaniesUseCase(fakes.companyRepository, fakes.unitOfWork);
}

describe('ListCompaniesUseCase', () => {
  it('lista todas las Companies (activas e inactivas) paginadas', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ pagination: { limit: 20, offset: 0 } });

    expect(fakes.companyRepository.list).toHaveBeenCalledWith({ limit: 20, offset: 0 }, FAKE_CTX);
    expect(result).toEqual({ data: [{ id: 'company-1' }], total: 1, limit: 20, offset: 0 });
  });
});

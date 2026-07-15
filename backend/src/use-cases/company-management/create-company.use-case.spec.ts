import { describe, expect, it, vi } from 'vitest';
import { CreateCompanyUseCase } from './create-company.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { companyRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateCompanyUseCase(fakes.companyRepository, fakes.unitOfWork);
}

describe('CreateCompanyUseCase', () => {
  it('crea la Company con el nombre recibido', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ name: 'ACME' });

    expect(fakes.companyRepository.create).toHaveBeenCalledWith({ name: 'ACME' }, FAKE_CTX);
    expect(result).toEqual({ id: 'company-1', name: 'ACME', isActive: true });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { CompanyNotFoundError } from './errors/company-not-found.error';
import { GetCompanyUseCase } from './get-company.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { companyRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetCompanyUseCase(fakes.companyRepository, fakes.unitOfWork);
}

describe('GetCompanyUseCase', () => {
  it('devuelve la Company encontrada', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ companyId: 'company-1' });

    expect(fakes.companyRepository.findById).toHaveBeenCalledWith('company-1', FAKE_CTX);
    expect(result).toEqual({ id: 'company-1', name: 'ACME', isActive: true });
  });

  it('lanza CompanyNotFoundError si no existe', async () => {
    const fakes = createFakes();
    fakes.companyRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ companyId: 'missing' })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
  });
});

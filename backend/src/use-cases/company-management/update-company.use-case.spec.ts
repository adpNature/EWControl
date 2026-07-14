import { describe, expect, it, vi } from 'vitest';
import { CompanyNotFoundError } from './errors/company-not-found.error';
import { UpdateCompanyUseCase } from './update-company.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME Corp', isActive: true }),
    deactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { companyRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new UpdateCompanyUseCase(fakes.companyRepository, fakes.unitOfWork);
}

describe('UpdateCompanyUseCase', () => {
  it('actualiza el nombre de la Company existente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ companyId: 'company-1', name: 'ACME Corp' });

    expect(fakes.companyRepository.update).toHaveBeenCalledWith(
      'company-1',
      { name: 'ACME Corp' },
      FAKE_CTX,
    );
    expect(result.name).toBe('ACME Corp');
  });

  it('lanza CompanyNotFoundError si no existe', async () => {
    const fakes = createFakes();
    fakes.companyRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ companyId: 'missing', name: 'x' })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
    expect(fakes.companyRepository.update).not.toHaveBeenCalled();
  });
});

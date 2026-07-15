import { describe, expect, it, vi } from 'vitest';
import { CompanyNotFoundError } from './errors/company-not-found.error';
import { DeactivateCompanyUseCase } from './deactivate-company.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: false }),
    reactivate: vi.fn(),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { companyRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new DeactivateCompanyUseCase(fakes.companyRepository, fakes.unitOfWork);
}

describe('DeactivateCompanyUseCase', () => {
  it('marca la Company como inactiva (baja lógica)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ companyId: 'company-1' });

    expect(fakes.companyRepository.deactivate).toHaveBeenCalledWith('company-1', FAKE_CTX);
  });

  it('lanza CompanyNotFoundError si no existe', async () => {
    const fakes = createFakes();
    fakes.companyRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ companyId: 'missing' })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
    expect(fakes.companyRepository.deactivate).not.toHaveBeenCalled();
  });
});

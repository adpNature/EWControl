import { describe, expect, it, vi } from 'vitest';
import { CreateDashboardUseCase } from './create-dashboard.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const dashboardRepository = {
    create: vi
      .fn()
      .mockResolvedValue({ id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' }),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { dashboardRepository, unitOfWork };
}

describe('CreateDashboardUseCase', () => {
  it('crea el Dashboard con el companyId recibido (nunca del payload directamente confiado sin más)', async () => {
    const fakes = createFakes();
    const useCase = new CreateDashboardUseCase(fakes.dashboardRepository, fakes.unitOfWork);

    const dashboard = await useCase.execute({ companyId: 'company-1', name: 'Planta 1' });

    expect(fakes.dashboardRepository.create).toHaveBeenCalledWith(
      { companyId: 'company-1', name: 'Planta 1' },
      FAKE_CTX,
    );
    expect(dashboard.name).toBe('Planta 1');
  });
});

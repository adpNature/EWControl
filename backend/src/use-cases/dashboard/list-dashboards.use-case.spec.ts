import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { ListDashboardsUseCase } from './list-dashboards.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const dashboardRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [{ id: 'dashboard-1' }], total: 1 }),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { dashboardRepository, unitOfWork };
}

describe('ListDashboardsUseCase', () => {
  it('filtra por la Company del requester cuando es AdminCliente', async () => {
    const fakes = createFakes();
    const useCase = new ListDashboardsUseCase(fakes.dashboardRepository, fakes.unitOfWork);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.dashboardRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1' },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('no filtra por Company cuando el requester es SuperAdmin', async () => {
    const fakes = createFakes();
    const useCase = new ListDashboardsUseCase(fakes.dashboardRepository, fakes.unitOfWork);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.dashboardRepository.list).toHaveBeenCalledWith(
      { companyId: null },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { UpdateDashboardUseCase } from './update-dashboard.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Old' };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const dashboardRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...DASHBOARD, name: 'New' }),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, dashboardRepository, unitOfWork };
}

describe('UpdateDashboardUseCase', () => {
  it('renombra el Dashboard resuelto', async () => {
    const fakes = createFakes();
    const useCase = new UpdateDashboardUseCase(
      fakes.resolver as never,
      fakes.dashboardRepository,
      fakes.unitOfWork,
    );

    const dashboard = await useCase.execute({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      name: 'New',
    });

    expect(fakes.dashboardRepository.update).toHaveBeenCalledWith(
      'dashboard-1',
      { name: 'New' },
      FAKE_CTX,
    );
    expect(dashboard.name).toBe('New');
  });
});

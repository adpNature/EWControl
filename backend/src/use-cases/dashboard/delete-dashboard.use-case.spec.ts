import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { DeleteDashboardUseCase } from './delete-dashboard.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const dashboardRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, dashboardRepository, unitOfWork };
}

describe('DeleteDashboardUseCase', () => {
  it('elimina físicamente el Dashboard resuelto (baja física, no lógica)', async () => {
    const fakes = createFakes();
    const useCase = new DeleteDashboardUseCase(
      fakes.resolver as never,
      fakes.dashboardRepository,
      fakes.unitOfWork,
    );

    await useCase.execute({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(fakes.dashboardRepository.delete).toHaveBeenCalledWith('dashboard-1', FAKE_CTX);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { WidgetType } from '../../entities/widget-type.enum';
import { GetDashboardUseCase } from './get-dashboard.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const widgetRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByDashboardId: vi.fn().mockResolvedValue([
      {
        id: 'widget-1',
        dashboardId: 'dashboard-1',
        widgetType: WidgetType.Value,
        widgetConfig: {},
        position: 0,
        signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
      },
    ]),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, widgetRepository, unitOfWork };
}

describe('GetDashboardUseCase', () => {
  it('devuelve el Dashboard con sus widgets y las Signals ya resueltas', async () => {
    const fakes = createFakes();
    const useCase = new GetDashboardUseCase(
      fakes.resolver as never,
      fakes.widgetRepository,
      fakes.unitOfWork,
    );

    const detail = await useCase.execute({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(detail.name).toBe('Planta 1');
    expect(detail.widgets).toEqual([
      {
        id: 'widget-1',
        widgetType: WidgetType.Value,
        widgetConfig: {},
        position: 0,
        signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
      },
    ]);
  });
});

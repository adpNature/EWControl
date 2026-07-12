import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { DeleteWidgetUseCase } from './delete-widget.use-case';
import { WidgetNotFoundError } from './errors/widget-not-found.error';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };
const WIDGET = { id: 'widget-1', dashboardId: 'dashboard-1' };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const widgetRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(WIDGET),
    findAllByDashboardId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, widgetRepository, unitOfWork };
}

describe('DeleteWidgetUseCase', () => {
  it('elimina físicamente el widget cuando pertenece al Dashboard resuelto', async () => {
    const fakes = createFakes();
    const useCase = new DeleteWidgetUseCase(
      fakes.resolver as never,
      fakes.widgetRepository,
      fakes.unitOfWork,
    );

    await useCase.execute({
      dashboardId: 'dashboard-1',
      widgetId: 'widget-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(fakes.widgetRepository.delete).toHaveBeenCalledWith('widget-1', FAKE_CTX);
  });

  it('lanza WidgetNotFoundError si el widget no pertenece al Dashboard resuelto', async () => {
    const fakes = createFakes();
    fakes.widgetRepository.findById.mockResolvedValue({
      id: 'widget-1',
      dashboardId: 'other-dashboard',
    });
    const useCase = new DeleteWidgetUseCase(
      fakes.resolver as never,
      fakes.widgetRepository,
      fakes.unitOfWork,
    );

    await expect(
      useCase.execute({
        dashboardId: 'dashboard-1',
        widgetId: 'widget-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(WidgetNotFoundError);
    expect(fakes.widgetRepository.delete).not.toHaveBeenCalled();
  });
});

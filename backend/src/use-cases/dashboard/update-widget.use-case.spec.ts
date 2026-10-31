import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { UpdateWidgetUseCase } from './update-widget.use-case';
import { WidgetNotFoundError } from './errors/widget-not-found.error';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };
const WIDGET = { id: 'widget-1', dashboardId: 'dashboard-1' };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const MACHINE = { id: 'machine-1', companyId: 'company-1', isActive: true };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const widgetRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(WIDGET),
    findAllByDashboardId: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...WIDGET, position: 2 }),
    delete: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(SIGNAL),
    findAllByMachineId: vi.fn(),
    findActiveDirectByMachineAndVariableName: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(MACHINE),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const writePackageRepository = {
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'package-1', machineId: 'machine-1', isActive: true }),
  };
  return {
    resolver,
    widgetRepository,
    signalRepository,
    machineRepository,
    writePackageRepository,
    unitOfWork,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new UpdateWidgetUseCase(
    fakes.resolver as never,
    fakes.widgetRepository,
    fakes.signalRepository,
    fakes.machineRepository,
    fakes.writePackageRepository as never,
    fakes.unitOfWork,
  );
}

describe('UpdateWidgetUseCase', () => {
  it('actualiza el widget cuando pertenece al Dashboard resuelto', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const widget = await useCase.execute({
      dashboardId: 'dashboard-1',
      widgetId: 'widget-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      position: 2,
    });

    expect(fakes.widgetRepository.update).toHaveBeenCalledWith(
      'widget-1',
      { widgetConfig: undefined, position: 2, signalIds: undefined },
      FAKE_CTX,
    );
    expect(widget.position).toBe(2);
  });

  it('lanza WidgetNotFoundError si el widget no pertenece al Dashboard resuelto', async () => {
    const fakes = createFakes();
    fakes.widgetRepository.findById.mockResolvedValue({
      id: 'widget-1',
      dashboardId: 'other-dashboard',
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        dashboardId: 'dashboard-1',
        widgetId: 'widget-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        position: 2,
      }),
    ).rejects.toBeInstanceOf(WidgetNotFoundError);
  });

  it('valida las nuevas signalIds si se proporcionan', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        dashboardId: 'dashboard-1',
        widgetId: 'widget-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        signalIds: ['signal-1'],
      }),
    ).rejects.toThrow();
    expect(fakes.widgetRepository.update).not.toHaveBeenCalled();
  });
});

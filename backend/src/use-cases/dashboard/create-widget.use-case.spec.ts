import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { WidgetType } from '../../entities/widget-type.enum';
import { CreateWidgetUseCase } from './create-widget.use-case';
import { SignalNotFoundForWidgetError } from './errors/signal-not-found-for-widget.error';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const MACHINE = { id: 'machine-1', companyId: 'company-1', isActive: true };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DASHBOARD) };
  const widgetRepository = {
    create: vi.fn().mockResolvedValue({ id: 'widget-1' }),
    findById: vi.fn(),
    findAllByDashboardId: vi.fn(),
    update: vi.fn(),
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
  return { resolver, widgetRepository, signalRepository, machineRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateWidgetUseCase(
    fakes.resolver as never,
    fakes.widgetRepository,
    fakes.signalRepository,
    fakes.machineRepository,
    fakes.unitOfWork,
  );
}

describe('CreateWidgetUseCase', () => {
  it('crea el widget cuando todas las Signals referenciadas son válidas', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      widgetType: WidgetType.Value,
      widgetConfig: {},
      signalIds: ['signal-1'],
    });

    expect(fakes.widgetRepository.create).toHaveBeenCalledWith(
      {
        dashboardId: 'dashboard-1',
        widgetType: WidgetType.Value,
        widgetConfig: {},
        position: 0,
        signalIds: ['signal-1'],
      },
      FAKE_CTX,
    );
  });

  it('lanza SignalNotFoundForWidgetError si una Signal no existe', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        dashboardId: 'dashboard-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        widgetType: WidgetType.Value,
        widgetConfig: {},
        signalIds: ['signal-1'],
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundForWidgetError);
    expect(fakes.widgetRepository.create).not.toHaveBeenCalled();
  });

  it('lanza SignalNotFoundForWidgetError si la Signal es de otra Company', async () => {
    const fakes = createFakes();
    fakes.machineRepository.findById.mockResolvedValue({ ...MACHINE, companyId: 'other-company' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        dashboardId: 'dashboard-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        widgetType: WidgetType.Value,
        widgetConfig: {},
        signalIds: ['signal-1'],
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundForWidgetError);
  });
});

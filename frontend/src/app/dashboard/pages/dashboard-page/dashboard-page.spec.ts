import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { DashboardDetail, DashboardWidget } from '../../entities/dashboard.model';
import { DashboardState } from '../../use-cases/dashboard.state';
import { DashboardPage } from './dashboard-page';

const ADMIN_AUTH_STATE = { currentUser: () => ({ role: 'AdminCliente' }), accessToken: () => null };
const OPERADOR_AUTH_STATE = { currentUser: () => ({ role: 'Operador' }), accessToken: () => null };

function createDashboardState(overrides: Record<string, unknown> = {}) {
  return {
    dashboards: () => [],
    activeDashboard: () => null,
    loading: () => false,
    loadDashboards: vi.fn().mockReturnValue(of([])),
    createDashboard: vi.fn(),
    open: vi.fn().mockReturnValue(of(null)),
    addWidget: vi.fn(),
    updateWidget: vi.fn(),
    removeWidget: vi.fn(),
    ...overrides,
  } as unknown as DashboardState;
}

describe('DashboardPage', () => {
  it('sin Dashboards, muestra el formulario para crear uno', async () => {
    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: ADMIN_AUTH_STATE },
        { provide: MachinesApiService, useValue: { list: vi.fn() } },
        { provide: SignalsApiService, useValue: { list: vi.fn() } },
        { provide: DashboardState, useValue: createDashboardState() },
      ],
    });

    expect(screen.getByText('Todavía no tienes ningún Dashboard.')).toBeInTheDocument();
  });

  it('sin Dashboards, crear uno llama a createDashboard() y abre el creado', async () => {
    const created = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };
    const createDashboard = vi.fn().mockReturnValue(of(created));
    const open = vi.fn().mockReturnValue(of(null));

    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: ADMIN_AUTH_STATE },
        { provide: MachinesApiService, useValue: { list: vi.fn() } },
        { provide: SignalsApiService, useValue: { list: vi.fn() } },
        { provide: DashboardState, useValue: createDashboardState({ createDashboard, open }) },
      ],
    });

    await userEvent.type(screen.getByLabelText('Nombre del Dashboard'), 'Planta 1');
    await userEvent.click(screen.getByRole('button', { name: 'Crear Dashboard' }));

    expect(createDashboard).toHaveBeenCalledWith({ name: 'Planta 1' });
    expect(open).toHaveBeenCalledWith('dashboard-1');
  });

  it('con un Dashboard activo, recorre sus widgets dinámicamente', async () => {
    const widgets: DashboardWidget[] = [
      {
        id: 'widget-1',
        widgetType: 'VALUE',
        widgetConfig: {},
        position: 0,
        signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
      },
      {
        id: 'widget-2',
        widgetType: 'ALARM_LIST',
        widgetConfig: {},
        position: 1,
        signals: [],
      },
    ];
    const detail: DashboardDetail = {
      id: 'dashboard-1',
      companyId: 'company-1',
      name: 'Planta 1',
      widgets,
    };

    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: ADMIN_AUTH_STATE },
        {
          provide: MachinesApiService,
          useValue: { list: vi.fn().mockReturnValue(of({ data: [] })) },
        },
        {
          provide: SignalsApiService,
          useValue: {
            getValue: vi.fn().mockReturnValue(
              of({
                signalId: 'signal-1',
                value: 24.8,
                quality: 'GOOD',
                timestamp: '2026-07-12T10:00:00Z',
                updatedAt: '2026-07-12T10:00:00Z',
              }),
            ),
          },
        },
        {
          provide: DashboardState,
          useValue: createDashboardState({ activeDashboard: () => detail }),
        },
      ],
    });

    expect(screen.getByText('Planta 1')).toBeInTheDocument();
    expect(screen.getByText('Sin alarmas activas.')).toBeInTheDocument();
  });

  it('Añadir widget: elige Machine y Signal, y llama a addWidget() sin recargar la página', async () => {
    const detail: DashboardDetail = {
      id: 'dashboard-1',
      companyId: 'company-1',
      name: 'Planta 1',
      widgets: [],
    };
    const addWidget = vi.fn().mockReturnValue(of({}));
    const machinesApi = {
      list: vi
        .fn()
        .mockReturnValue(
          of({ data: [{ id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1' }] }),
        ),
    };
    const signalsApi = {
      list: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'signal-1',
              machineId: 'machine-1',
              name: 'Temperatura',
              unit: '°C',
              signalType: 'DIRECT',
              signalSource: { variableName: 'temperature' },
              historyEnabled: false,
            },
          ],
        }),
      ),
    };

    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: ADMIN_AUTH_STATE },
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
        {
          provide: DashboardState,
          useValue: createDashboardState({ activeDashboard: () => detail, addWidget }),
        },
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Añadir widget' }));
    await userEvent.selectOptions(screen.getByLabelText('Machine'), 'machine-1');
    await userEvent.click(await screen.findByLabelText('Temperatura'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear widget' }));

    expect(addWidget).toHaveBeenCalledWith(
      'dashboard-1',
      expect.objectContaining({ widgetType: 'VALUE', signalIds: ['signal-1'] }),
    );
  });

  it('un Operador sin Dashboards no ve el formulario de creación (spec 19, criterio frontend 4)', async () => {
    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: OPERADOR_AUTH_STATE },
        { provide: MachinesApiService, useValue: { list: vi.fn() } },
        { provide: SignalsApiService, useValue: { list: vi.fn() } },
        { provide: DashboardState, useValue: createDashboardState() },
      ],
    });

    expect(screen.getByText(/Pide a un administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear Dashboard' })).not.toBeInTheDocument();
  });

  it('un Operador ve los widgets pero no el botón "Añadir widget" (spec 19, criterio frontend 4)', async () => {
    const detail: DashboardDetail = {
      id: 'dashboard-1',
      companyId: 'company-1',
      name: 'Planta 1',
      widgets: [],
    };

    await render(DashboardPage, {
      providers: [
        { provide: AuthStateService, useValue: OPERADOR_AUTH_STATE },
        { provide: MachinesApiService, useValue: { list: vi.fn() } },
        { provide: SignalsApiService, useValue: { list: vi.fn() } },
        {
          provide: DashboardState,
          useValue: createDashboardState({ activeDashboard: () => detail }),
        },
      ],
    });

    expect(screen.getByRole('heading', { name: 'Planta 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Añadir widget' })).not.toBeInTheDocument();
  });
});

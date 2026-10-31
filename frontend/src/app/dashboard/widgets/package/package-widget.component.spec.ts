import { render, screen } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import {
  MachineConnectedEvent,
  MachineDisconnectedEvent,
} from '../../../core/websocket/realtime-events.model';
import { WritePackagesApiService } from '../../../write-packages/adapters/write-packages-api.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { PackageWidgetComponent } from './package-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'PACKAGE',
  widgetConfig: { machineId: 'machine-1', writePackageId: 'package-1' },
  position: 0,
  signals: [],
};

const WRITE_PACKAGE = {
  id: 'package-1',
  machineId: 'machine-1',
  name: 'Formato 120 mm',
  description: null,
  items: [
    { signalVariableName: 'Escritura_REAL', value: 120 },
    { signalVariableName: 'Escritura_BOOL', value: true },
  ],
  isActive: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

describe('PackageWidgetComponent (docs/specs/20-paquetes-escritura-opc-ua.md)', () => {
  let writePackagesApi: { list: ReturnType<typeof vi.fn>; execute: ReturnType<typeof vi.fn> };
  let machineConnected: Subject<MachineConnectedEvent>;
  let machineDisconnected: Subject<MachineDisconnectedEvent>;

  beforeEach(() => {
    writePackagesApi = {
      list: vi
        .fn()
        .mockReturnValue(of({ providerType: 'OpcUa', connected: true, packages: [WRITE_PACKAGE] })),
      execute: vi.fn(),
    };
    machineConnected = new Subject();
    machineDisconnected = new Subject();
  });

  function renderWidget() {
    return render(PackageWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: WritePackagesApiService, useValue: writePackagesApi },
        {
          provide: RealtimeSocketService,
          useValue: {
            machineConnected$: machineConnected.asObservable(),
            machineDisconnected$: machineDisconnected.asObservable(),
          },
        },
      ],
    });
  }

  it('muestra el paquete, sus valores y el botón "Ejecutar" habilitado', async () => {
    await renderWidget();

    expect(writePackagesApi.list).toHaveBeenCalledWith('machine-1');
    expect(screen.getByRole('heading', { name: 'Formato 120 mm' })).toBeInTheDocument();
    expect(screen.getByText('Escritura_REAL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ejecutar/ })).toBeEnabled();
  });

  it('deshabilita "Ejecutar" al llegar MachineDisconnected y lo rehabilita al reconectar', async () => {
    const { fixture } = await renderWidget();

    machineDisconnected.next({ machineId: 'machine-1', timestamp: '2026-10-30T10:00:00Z' });
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: /Ejecutar/ })).toBeDisabled();
    expect(screen.getByText(/no está conectada/)).toBeInTheDocument();

    machineConnected.next({ machineId: 'machine-1', timestamp: '2026-10-30T10:01:00Z' });
    fixture.detectChanges();
    expect(screen.getByRole('button', { name: /Ejecutar/ })).toBeEnabled();
  });

  it('ignora eventos de conexión de otras Machines', async () => {
    const { fixture } = await renderWidget();

    machineDisconnected.next({ machineId: 'machine-2', timestamp: '2026-10-30T10:00:00Z' });
    fixture.detectChanges();

    expect(screen.getByRole('button', { name: /Ejecutar/ })).toBeEnabled();
  });

  it('avisa si el paquete ya no existe (dado de baja)', async () => {
    writePackagesApi.list.mockReturnValue(
      of({ providerType: 'OpcUa', connected: true, packages: [] }),
    );

    await renderWidget();

    expect(screen.getByText(/Este paquete ya no existe/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ejecutar/ })).not.toBeInTheDocument();
  });

  it('un fallo de carga queda aislado en el widget', async () => {
    writePackagesApi.list.mockReturnValue(throwError(() => new Error('boom')));

    await renderWidget();

    expect(screen.getByText('No se ha podido cargar el paquete.')).toBeInTheDocument();
  });
});

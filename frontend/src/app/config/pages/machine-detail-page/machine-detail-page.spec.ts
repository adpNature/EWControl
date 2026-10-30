import { ActivatedRoute, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { MachinesState } from '../../use-cases/machines.state';
import { SignalsState } from '../../use-cases/signals.state';
import { MachineDetailPage } from './machine-detail-page';

const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1' };
const SIGNAL = {
  id: 'signal-1',
  machineId: 'machine-1',
  name: 'Temperatura',
  signalType: 'DIRECT' as const,
  signalSource: { variableName: 'temperature' },
  unit: '°C',
  historyEnabled: false,
};

function activatedRouteStub() {
  return { snapshot: { paramMap: { get: () => 'machine-1' } } };
}

describe('MachineDetailPage', () => {
  let machinesApi: { get: ReturnType<typeof vi.fn> };
  let machinesState: { machines: () => (typeof MACHINE)[]; remove: ReturnType<typeof vi.fn> };
  let signalsState: {
    signals: () => (typeof SIGNAL)[];
    load: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    machinesApi = { get: vi.fn() };
    machinesState = { machines: () => [MACHINE], remove: vi.fn().mockReturnValue(of(undefined)) };
    signalsState = {
      signals: () => [SIGNAL],
      load: vi.fn().mockReturnValue(of([SIGNAL])),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    router = { navigate: vi.fn() };
    toastService = { show: vi.fn() };
  });

  function renderPage(role: 'AdminCliente' | 'none' = 'AdminCliente') {
    return render(MachineDetailPage, {
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: MachinesState, useValue: machinesState },
        { provide: SignalsState, useValue: signalsState },
        {
          provide: AuthStateService,
          useValue: { currentUser: () => (role === 'none' ? null : { role }) },
        },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub() },
        { provide: ToastService, useValue: toastService },
      ],
    });
  }

  it('muestra el nombre de la Machine y su tabla de Signals', async () => {
    await renderPage();

    expect(screen.getByRole('heading', { name: 'Bobinadora 1' })).toBeInTheDocument();
    expect(screen.getByText('Temperatura')).toBeInTheDocument();
  });

  it('click en "Editar" (Machine) navega a la edición de la Machine', async () => {
    await renderPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

    expect(router.navigate).toHaveBeenCalledWith(['/config/machines', 'machine-1', 'edit']);
  });

  it('click en "Editar" (Signal) navega a la edición de la Signal', async () => {
    await renderPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1]);

    expect(router.navigate).toHaveBeenCalledWith([
      '/config/machines',
      'machine-1',
      'signals',
      'signal-1',
      'edit',
    ]);
  });

  it('confirmar "Eliminar Machine" llama a remove() y navega al listado', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Machine' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );

    expect(machinesState.remove).toHaveBeenCalledWith('machine-1');
    expect(router.navigate).toHaveBeenCalledWith(['/config/machines']);
  });

  it('la advertencia de borrado menciona la desactivación de las Signals', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Machine' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(/Signals/);
  });

  it('confirmar "Eliminar" en una Signal llama a signalsState.remove()', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Eliminar' }),
    );

    expect(signalsState.remove).toHaveBeenCalledWith('machine-1', 'signal-1');
  });

  it('oculta las acciones de configuración sin rol autorizado', async () => {
    await renderPage('none');

    expect(screen.queryByRole('button', { name: 'Eliminar Machine' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva Signal' })).not.toBeInTheDocument();
  });

  it('ofrece el acceso a la pantalla de conexión de la Machine (spec 18)', async () => {
    await renderPage();

    // Con el Router simulado, routerLink no genera href: se comprueba el ancla por su texto.
    expect(screen.getByText('Conexión').closest('a')).toBeInTheDocument();
  });

  it('oculta el acceso a la conexión sin rol de configuración', async () => {
    await renderPage('none');

    expect(screen.queryByText('Conexión')).not.toBeInTheDocument();
  });
});

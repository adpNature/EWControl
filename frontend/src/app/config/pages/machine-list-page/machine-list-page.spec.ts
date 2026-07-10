import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { MachinesState } from '../../use-cases/machines.state';
import { MachineListPage } from './machine-list-page';

const MACHINES = [
  { id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1' },
  { id: 'machine-2', companyId: 'company-1', name: 'Bobinadora 2' },
];

function renderPage(role: 'AdminCliente' | 'SuperAdmin' | undefined) {
  const machinesState = {
    machines: () => MACHINES,
    load: vi.fn().mockReturnValue(of(MACHINES)),
  };
  const authState = { currentUser: () => (role ? { role } : null) };

  return render(MachineListPage, {
    providers: [
      { provide: MachinesState, useValue: machinesState },
      { provide: AuthStateService, useValue: authState },
      provideRouter([]),
    ],
  });
}

describe('MachineListPage', () => {
  it('lista los nombres de las Machines cargadas', async () => {
    await renderPage('AdminCliente');

    expect(screen.getByText('Bobinadora 1')).toBeInTheDocument();
    expect(screen.getByText('Bobinadora 2')).toBeInTheDocument();
  });

  it('muestra "Nueva Machine" para un rol con permiso de configuración', async () => {
    await renderPage('AdminCliente');

    expect(screen.getByRole('link', { name: 'Nueva Machine' })).toBeInTheDocument();
  });

  it('oculta "Nueva Machine" si no hay rol de configuración', async () => {
    await renderPage(undefined);

    expect(screen.queryByRole('link', { name: 'Nueva Machine' })).not.toBeInTheDocument();
  });
});

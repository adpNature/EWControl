import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { CompaniesState } from '../../use-cases/companies.state';
import { SelectedCompanyState } from '../../use-cases/selected-company.state';
import { UsersState } from '../../use-cases/users.state';
import { UserListPage } from './user-list-page';

const USERS = [
  {
    id: 'user-1',
    companyId: 'company-1',
    email: 'demo@ewcontrol.local',
    role: 'AdminCliente',
    isActive: true,
  },
  {
    id: 'user-2',
    companyId: 'company-1',
    email: 'otro@ewcontrol.local',
    role: 'AdminCliente',
    isActive: true,
  },
];

async function renderPage(currentUserId: string, role: 'AdminCliente' | 'SuperAdmin') {
  const usersState = {
    users: () => USERS,
    load: vi.fn().mockReturnValue(of(USERS)),
    remove: vi.fn().mockReturnValue(of(undefined)),
    reactivate: vi.fn().mockReturnValue(of(USERS[1])),
  };
  const companiesState = { companies: () => [], load: vi.fn().mockReturnValue(of([])) };
  const selectedCompanyState = { selectedCompanyId: () => null, select: vi.fn(), clear: vi.fn() };
  const authState = { currentUser: () => ({ id: currentUserId, role }) };

  await render(UserListPage, {
    providers: [
      { provide: UsersState, useValue: usersState },
      { provide: CompaniesState, useValue: companiesState },
      { provide: SelectedCompanyState, useValue: selectedCompanyState },
      { provide: AuthStateService, useValue: authState },
      provideRouter([]),
    ],
  });

  return { usersState, companiesState };
}

describe('UserListPage', () => {
  it('lista los emails de los Users cargados', async () => {
    await renderPage('user-1', 'AdminCliente');

    expect(screen.getByText('demo@ewcontrol.local')).toBeInTheDocument();
    expect(screen.getByText('otro@ewcontrol.local')).toBeInTheDocument();
  });

  it('no muestra el switcher de Company para AdminCliente', async () => {
    await renderPage('user-1', 'AdminCliente');

    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
  });

  it('muestra el switcher de Company para SuperAdmin', async () => {
    await renderPage('user-1', 'SuperAdmin');

    expect(screen.getByLabelText('Company')).toBeInTheDocument();
  });

  it('deshabilita "Dar de baja" en la propia fila', async () => {
    await renderPage('user-1', 'AdminCliente');

    const rows = screen.getAllByRole('button', { name: 'Dar de baja' });
    expect(rows[0]).toBeDisabled();
    expect(rows[1]).toBeEnabled();
  });

  it('da de baja a otro User tras confirmar', async () => {
    const { usersState } = await renderPage('user-1', 'AdminCliente');

    const rows = screen.getAllByRole('button', { name: 'Dar de baja' });
    await userEvent.click(rows[1]);
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Dar de baja' }),
    );

    expect(usersState.remove).toHaveBeenCalledWith('user-2');
  });

  it('muestra la columna Estado con Activo/Inactivo', async () => {
    await renderPage('user-1', 'AdminCliente');

    expect(screen.getAllByText('Activo')).toHaveLength(2);
  });

  it('muestra "Reactivar" en vez de "Dar de baja" para un User inactivo, y lo reactiva sin diálogo', async () => {
    const inactiveUsers = [
      { ...USERS[0], isActive: false },
      { ...USERS[1], isActive: true },
    ];
    const usersState = {
      users: () => inactiveUsers,
      load: vi.fn().mockReturnValue(of(inactiveUsers)),
      remove: vi.fn().mockReturnValue(of(undefined)),
      reactivate: vi.fn().mockReturnValue(of(inactiveUsers[0])),
    };
    const companiesState = { companies: () => [], load: vi.fn().mockReturnValue(of([])) };
    const selectedCompanyState = {
      selectedCompanyId: () => null,
      select: vi.fn(),
      clear: vi.fn(),
    };
    const authState = { currentUser: () => ({ id: 'someone-else', role: 'AdminCliente' }) };

    await render(UserListPage, {
      providers: [
        { provide: UsersState, useValue: usersState },
        { provide: CompaniesState, useValue: companiesState },
        { provide: SelectedCompanyState, useValue: selectedCompanyState },
        { provide: AuthStateService, useValue: authState },
        provideRouter([]),
      ],
    });

    expect(screen.getAllByRole('button', { name: 'Dar de baja' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar' }));

    expect(usersState.reactivate).toHaveBeenCalledWith('user-1');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

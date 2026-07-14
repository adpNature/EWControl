import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { CompaniesState } from '../../use-cases/companies.state';
import { CompanyListPage } from './company-list-page';

const COMPANIES = [
  { id: 'company-1', name: 'ACME', isActive: true },
  { id: 'company-2', name: 'Globex', isActive: false },
];

function createCompaniesState() {
  return {
    companies: () => COMPANIES,
    load: vi.fn().mockReturnValue(of(COMPANIES)),
    remove: vi.fn().mockReturnValue(of(undefined)),
    reactivate: vi.fn().mockReturnValue(of(COMPANIES[0])),
    purge: vi.fn().mockReturnValue(of(undefined)),
  };
}

function renderPage(
  role: 'AdminCliente' | 'SuperAdmin' | undefined,
  companiesState = createCompaniesState(),
) {
  const authState = { currentUser: () => (role ? { role } : null) };

  return render(CompanyListPage, {
    providers: [
      { provide: CompaniesState, useValue: companiesState },
      { provide: AuthStateService, useValue: authState },
      provideRouter([]),
    ],
  }).then((result) => ({ ...result, companiesState }));
}

describe('CompanyListPage', () => {
  it('lista los nombres y el estado de las Companies cargadas', async () => {
    await renderPage('SuperAdmin');

    expect(screen.getByText('ACME')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
  });

  it('muestra "Nueva Company" para SuperAdmin', async () => {
    await renderPage('SuperAdmin');

    expect(screen.getByRole('link', { name: 'Nueva Company' })).toBeInTheDocument();
  });

  it('oculta "Nueva Company" para AdminCliente', async () => {
    await renderPage('AdminCliente');

    expect(screen.queryByRole('link', { name: 'Nueva Company' })).not.toBeInTheDocument();
  });

  it('da de baja una Company tras confirmar el diálogo', async () => {
    const { companiesState } = await renderPage('SuperAdmin');

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Dar de baja' }),
    );

    expect(companiesState.remove).toHaveBeenCalledWith('company-1');
  });

  it('muestra "Reactivar" solo para la Company inactiva y la reactiva sin diálogo', async () => {
    const { companiesState } = await renderPage('SuperAdmin');

    const reactivateButtons = screen.getAllByRole('button', { name: 'Reactivar' });
    expect(reactivateButtons).toHaveLength(1);

    await userEvent.click(reactivateButtons[0]);

    expect(companiesState.reactivate).toHaveBeenCalledWith('company-2');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('"Eliminar permanentemente" está visible para Companies activas e inactivas', async () => {
    await renderPage('SuperAdmin');

    expect(screen.getAllByRole('button', { name: 'Eliminar permanentemente' })).toHaveLength(2);
  });

  it('el diálogo de borrado permanente exige teclear el nombre exacto antes de confirmar', async () => {
    const { companiesState } = await renderPage('SuperAdmin');

    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar permanentemente' })[0]);
    const dialog = screen.getByRole('alertdialog');
    const confirmButton = within(dialog).getByRole('button', {
      name: 'Eliminar permanentemente',
    });

    expect(confirmButton).toBeDisabled();
    await userEvent.type(within(dialog).getByRole('textbox'), 'ACME');
    expect(confirmButton).toBeEnabled();

    await userEvent.click(confirmButton);

    expect(companiesState.purge).toHaveBeenCalledWith('company-1');
  });
});

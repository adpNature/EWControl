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

function renderPage(role: 'AdminCliente' | 'SuperAdmin' | undefined) {
  const companiesState = {
    companies: () => COMPANIES,
    load: vi.fn().mockReturnValue(of(COMPANIES)),
    remove: vi.fn().mockReturnValue(of(undefined)),
  };
  const authState = { currentUser: () => (role ? { role } : null) };

  return render(CompanyListPage, {
    providers: [
      { provide: CompaniesState, useValue: companiesState },
      { provide: AuthStateService, useValue: authState },
      provideRouter([]),
    ],
  });
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
    const companiesState = {
      companies: () => COMPANIES,
      load: vi.fn().mockReturnValue(of(COMPANIES)),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    await render(CompanyListPage, {
      providers: [
        { provide: CompaniesState, useValue: companiesState },
        { provide: AuthStateService, useValue: { currentUser: () => ({ role: 'SuperAdmin' }) } },
        provideRouter([]),
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Dar de baja' }),
    );

    expect(companiesState.remove).toHaveBeenCalledWith('company-1');
  });
});

import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { CompaniesApiService } from '../../adapters/companies-api.service';
import { CompaniesState } from '../../use-cases/companies.state';
import { CompanyFormPage } from './company-form-page';

function activatedRouteStub(companyId: string | null) {
  return {
    snapshot: { paramMap: { get: (key: string) => (key === 'companyId' ? companyId : null) } },
  };
}

describe('CompanyFormPage', () => {
  let companiesApi: { get: ReturnType<typeof vi.fn> };
  let companiesState: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    companiesApi = { get: vi.fn() };
    companiesState = { create: vi.fn(), update: vi.fn() };
    router = { navigate: vi.fn() };
  });

  function renderPage(companyId: string | null) {
    return render(CompanyFormPage, {
      providers: [
        { provide: CompaniesApiService, useValue: companiesApi },
        { provide: CompaniesState, useValue: companiesState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(companyId) },
      ],
    });
  }

  it('modo alta: no consulta ninguna Company y el título es "Nueva Company"', async () => {
    await renderPage(null);

    expect(screen.getByRole('heading', { name: 'Nueva Company' })).toBeInTheDocument();
    expect(companiesApi.get).not.toHaveBeenCalled();
  });

  it('modo edición: precarga el nombre de la Company existente', async () => {
    companiesApi.get.mockReturnValue(of({ id: 'company-1', name: 'ACME', isActive: true }));

    await renderPage('company-1');

    expect(screen.getByRole('heading', { name: 'Editar Company' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre')).toHaveValue('ACME');
  });

  it('no llama a create si el formulario es inválido', async () => {
    await renderPage(null);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(companiesState.create).not.toHaveBeenCalled();
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
  });

  it('en alta correcta navega al alta del primer User de esa Company', async () => {
    companiesState.create.mockReturnValue(of({ id: 'company-1', name: 'ACME', isActive: true }));
    await renderPage(null);

    await userEvent.type(screen.getByLabelText('Nombre'), 'ACME');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(companiesState.create).toHaveBeenCalledWith({ name: 'ACME' });
    expect(router.navigate).toHaveBeenCalledWith(['/config/users/new'], {
      queryParams: { companyId: 'company-1' },
    });
  });

  it('en edición correcta navega al listado de Companies', async () => {
    companiesApi.get.mockReturnValue(of({ id: 'company-1', name: 'ACME', isActive: true }));
    companiesState.update.mockReturnValue(
      of({ id: 'company-1', name: 'ACME Corp', isActive: true }),
    );
    await renderPage('company-1');
    await screen.findByDisplayValue('ACME');

    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.type(screen.getByLabelText('Nombre'), 'ACME Corp');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(companiesState.update).toHaveBeenCalledWith('company-1', { name: 'ACME Corp' });
    expect(router.navigate).toHaveBeenCalledWith(['/config/companies']);
  });

  it('muestra el error de COMPANY_NOT_FOUND sin perder los datos del formulario', async () => {
    companiesApi.get.mockReturnValue(of({ id: 'company-1', name: 'ACME', isActive: true }));
    companiesState.update.mockReturnValue(
      throwError(() => ({ status: 404, code: 'COMPANY_NOT_FOUND', message: 'irrelevante' })),
    );
    await renderPage('company-1');
    await screen.findByDisplayValue('ACME');

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe');
    expect(screen.getByLabelText('Nombre')).toHaveValue('ACME');
  });
});

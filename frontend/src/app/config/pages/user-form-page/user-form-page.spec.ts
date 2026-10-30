import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { UsersApiService } from '../../adapters/users-api.service';
import { Company } from '../../entities/company.model';
import { CompaniesState } from '../../use-cases/companies.state';
import { SelectedCompanyState } from '../../use-cases/selected-company.state';
import { UsersState } from '../../use-cases/users.state';
import { UserFormPage } from './user-form-page';

const COMPANIES: Company[] = [
  { id: 'company-1', name: 'ACME', isActive: true },
  { id: 'company-2', name: 'Globex', isActive: true },
];

function activatedRouteStub(userId: string | null) {
  return {
    snapshot: {
      paramMap: { get: (key: string) => (key === 'userId' ? userId : null) },
    },
  };
}

describe('UserFormPage', () => {
  let usersApi: { get: ReturnType<typeof vi.fn> };
  let usersState: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let companiesState: { companies: () => Company[]; load: ReturnType<typeof vi.fn> };
  let selectedCompanyState: { selectedCompanyId: () => string | null };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    usersApi = { get: vi.fn() };
    usersState = { create: vi.fn(), update: vi.fn() };
    companiesState = { companies: () => COMPANIES, load: vi.fn().mockReturnValue(of(COMPANIES)) };
    selectedCompanyState = { selectedCompanyId: () => null };
    router = { navigate: vi.fn() };
  });

  function renderPage(userId: string | null, role: 'AdminCliente' | 'SuperAdmin' = 'AdminCliente') {
    return render(UserFormPage, {
      providers: [
        { provide: UsersApiService, useValue: usersApi },
        { provide: UsersState, useValue: usersState },
        { provide: CompaniesState, useValue: companiesState },
        { provide: SelectedCompanyState, useValue: selectedCompanyState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(userId) },
        { provide: AuthStateService, useValue: { currentUser: () => ({ role }) } },
      ],
    });
  }

  it('modo alta: pide contraseña y el título es "Nuevo User"', async () => {
    await renderPage(null);

    expect(screen.getByRole('heading', { name: 'Nuevo User' })).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(usersApi.get).not.toHaveBeenCalled();
  });

  it('modo edición: no pide contraseña y precarga email/rol', async () => {
    usersApi.get.mockReturnValue(
      of({ id: 'user-1', companyId: 'c', email: 'demo@ewcontrol.local', role: 'AdminCliente' }),
    );

    await renderPage('user-1');

    expect(screen.getByRole('heading', { name: 'Editar User' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Email')).toHaveValue('demo@ewcontrol.local');
  });

  it('el selector de rol solo ofrece SuperAdmin cuando el requester ya lo es', async () => {
    await renderPage(null, 'AdminCliente');

    expect(screen.queryByRole('option', { name: 'SuperAdmin' })).not.toBeInTheDocument();
  });

  it('el selector de rol ofrece Operador con su texto de ayuda (spec 19, criterio frontend 1)', async () => {
    await renderPage(null, 'AdminCliente');

    expect(screen.getByRole('option', { name: 'Operador' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'Operador');
    expect(screen.getByText(/reconoce alarmas; no configura nada/)).toBeInTheDocument();
  });

  it('el selector de rol ofrece SuperAdmin cuando el requester es SuperAdmin', async () => {
    await renderPage(null, 'SuperAdmin');

    expect(screen.getByRole('option', { name: 'SuperAdmin' })).toBeInTheDocument();
  });

  it('no llama a create si el formulario es inválido', async () => {
    await renderPage(null);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(usersState.create).not.toHaveBeenCalled();
  });

  it('muestra el error de EMAIL_ALREADY_EXISTS sin perder los datos del formulario', async () => {
    usersState.create.mockReturnValue(
      throwError(() => ({ status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'irrelevante' })),
    );
    await renderPage(null);

    await userEvent.type(screen.getByLabelText('Email'), 'ya-existe@ewcontrol.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('email');
    expect(screen.getByLabelText('Email')).toHaveValue('ya-existe@ewcontrol.local');
  });

  describe('selector de Company (alta por SuperAdmin)', () => {
    it('es visible al dar de alta como SuperAdmin', async () => {
      await renderPage(null, 'SuperAdmin');

      expect(screen.getByLabelText('Company')).toBeInTheDocument();
    });

    it('no es visible al dar de alta como AdminCliente', async () => {
      await renderPage(null, 'AdminCliente');

      expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
    });

    it('no es visible en modo edición, ni siquiera para SuperAdmin', async () => {
      usersApi.get.mockReturnValue(
        of({
          id: 'user-1',
          companyId: 'company-1',
          email: 'demo@ewcontrol.local',
          role: 'AdminCliente',
        }),
      );

      await renderPage('user-1', 'SuperAdmin');

      expect(await screen.findByLabelText('Email')).toHaveValue('demo@ewcontrol.local');
      expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
    });

    it('se pre-rellena con la Company seleccionada en el switcher de la lista', async () => {
      selectedCompanyState.selectedCompanyId = () => 'company-2';

      await renderPage(null, 'SuperAdmin');

      expect(screen.getByLabelText('Company')).toHaveValue('company-2');
    });

    it('sin Company elegida, el formulario no permite guardar (obligatorio)', async () => {
      await renderPage(null, 'SuperAdmin');

      await userEvent.type(screen.getByLabelText('Email'), 'nuevo@ewcontrol.local');
      await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(usersState.create).not.toHaveBeenCalled();
    });

    it('al elegir una Company del selector, se envía en el alta y navega al listado', async () => {
      usersState.create.mockReturnValue(of({ id: 'user-1' }));
      await renderPage(null, 'SuperAdmin');

      await userEvent.selectOptions(screen.getByLabelText('Company'), 'company-2');
      await userEvent.type(screen.getByLabelText('Email'), 'nuevo@ewcontrol.local');
      await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(usersState.create).toHaveBeenCalledWith({
        companyId: 'company-2',
        email: 'nuevo@ewcontrol.local',
        password: 'Demo1234!',
        role: 'AdminCliente',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/config/users']);
    });
  });
});

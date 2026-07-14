import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { UsersApiService } from '../../adapters/users-api.service';
import { UsersState } from '../../use-cases/users.state';
import { UserFormPage } from './user-form-page';

function activatedRouteStub(userId: string | null, companyId: string | null = null) {
  return {
    snapshot: {
      paramMap: { get: (key: string) => (key === 'userId' ? userId : null) },
      queryParamMap: { get: (key: string) => (key === 'companyId' ? companyId : null) },
    },
  };
}

describe('UserFormPage', () => {
  let usersApi: { get: ReturnType<typeof vi.fn> };
  let usersState: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    usersApi = { get: vi.fn() };
    usersState = { create: vi.fn(), update: vi.fn() };
    router = { navigate: vi.fn() };
  });

  function renderPage(
    userId: string | null,
    companyId: string | null = null,
    role: 'AdminCliente' | 'SuperAdmin' = 'AdminCliente',
  ) {
    return render(UserFormPage, {
      providers: [
        { provide: UsersApiService, useValue: usersApi },
        { provide: UsersState, useValue: usersState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(userId, companyId) },
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
    await renderPage(null, null, 'AdminCliente');

    expect(screen.queryByRole('option', { name: 'SuperAdmin' })).not.toBeInTheDocument();
  });

  it('el selector de rol ofrece SuperAdmin cuando el requester es SuperAdmin', async () => {
    await renderPage(null, null, 'SuperAdmin');

    expect(screen.getByRole('option', { name: 'SuperAdmin' })).toBeInTheDocument();
  });

  it('en alta correcta reenvía companyId de la query y navega al listado', async () => {
    usersState.create.mockReturnValue(of({ id: 'user-1' }));
    await renderPage(null, 'company-1', 'SuperAdmin');

    await userEvent.type(screen.getByLabelText('Email'), 'nuevo@ewcontrol.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(usersState.create).toHaveBeenCalledWith({
      companyId: 'company-1',
      email: 'nuevo@ewcontrol.local',
      password: 'Demo1234!',
      role: 'AdminCliente',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/config/users']);
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
});

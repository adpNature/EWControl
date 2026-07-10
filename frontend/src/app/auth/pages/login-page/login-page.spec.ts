import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../use-cases/auth.state';
import { LoginPage } from './login-page';

function activatedRouteStub(returnUrl: string | null = null) {
  return { snapshot: { queryParamMap: { get: () => returnUrl } } };
}

describe('LoginPage', () => {
  let authState: { login: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authState = { login: vi.fn() };
    router = { navigateByUrl: vi.fn() };
  });

  function renderPage(returnUrl: string | null = null) {
    return render(LoginPage, {
      providers: [
        { provide: AuthStateService, useValue: authState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(returnUrl) },
      ],
    });
  }

  it('renderiza los campos accesibles por label y el botón "Entrar"', async () => {
    await renderPage();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('no llama al backend si el formulario es inválido y muestra el error de campo', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(authState.login).not.toHaveBeenCalled();
    expect(screen.getByText('El email es obligatorio.')).toBeInTheDocument();
  });

  it('en login correcto navega a returnUrl si viene en la query, si no a /dashboard', async () => {
    authState.login.mockReturnValue(
      of({
        id: 'user-1',
        email: 'demo@ewcontrol.local',
        role: 'AdminCliente',
        companyId: 'company-1',
      }),
    );
    await renderPage('/machines');

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(authState.login).toHaveBeenCalledWith('demo@ewcontrol.local', 'Demo1234!');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/machines');
  });

  it('muestra un único mensaje genérico ante credenciales inválidas (401)', async () => {
    authState.login.mockReturnValue(
      throwError(() => ({ status: 401, code: 'INVALID_CREDENTIALS', message: 'irrelevante' })),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });

  it('muestra el mensaje de espera ante 429', async () => {
    authState.login.mockReturnValue(
      throwError(() => ({ status: 429, code: 'TOO_MANY_REQUESTS', message: 'irrelevante' })),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Demo1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });
});

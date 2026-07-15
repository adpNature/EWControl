import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthApiService } from '../../adapters/auth-api.service';
import { ResetPasswordPage } from './reset-password-page';

function activatedRouteStub(token: string | null) {
  return {
    snapshot: { queryParamMap: { get: (key: string) => (key === 'token' ? token : null) } },
  };
}

describe('ResetPasswordPage', () => {
  let authApi: { resetPassword: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authApi = { resetPassword: vi.fn() };
    toastService = { show: vi.fn() };
    router = { navigateByUrl: vi.fn() };
  });

  function renderPage(token: string | null = 'reset-token-1') {
    return render(ResetPasswordPage, {
      providers: [
        { provide: AuthApiService, useValue: authApi },
        { provide: ToastService, useValue: toastService },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(token) },
      ],
    });
  }

  it('no llama a resetPassword si la contraseña es inválida', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it('en éxito muestra un toast y navega a /login', async () => {
    authApi.resetPassword.mockReturnValue(of(undefined));
    await renderPage('reset-token-1');

    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(authApi.resetPassword).toHaveBeenCalledWith('reset-token-1', 'Nueva1234!');
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Contraseña restablecida.',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('muestra el enlace para solicitar uno nuevo cuando el token ya no es válido', async () => {
    authApi.resetPassword.mockReturnValue(
      throwError(() => ({ status: 401, code: 'INVALID_RESET_TOKEN', message: 'x' })),
    );
    await renderPage('reset-token-1');

    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('enlace');
    expect(screen.getByRole('link', { name: 'Solicitar un nuevo enlace' })).toBeInTheDocument();
  });
});

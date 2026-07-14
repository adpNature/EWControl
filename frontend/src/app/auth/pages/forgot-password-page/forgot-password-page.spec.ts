import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '../../adapters/auth-api.service';
import { ForgotPasswordPage } from './forgot-password-page';

describe('ForgotPasswordPage', () => {
  let authApi: { forgotPassword: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authApi = { forgotPassword: vi.fn() };
  });

  function renderPage() {
    return render(ForgotPasswordPage, {
      providers: [{ provide: AuthApiService, useValue: authApi }],
    });
  }

  it('no llama al servicio si el email es inválido', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

    expect(authApi.forgotPassword).not.toHaveBeenCalled();
    expect(screen.getByText('Introduce un email válido.')).toBeInTheDocument();
  });

  it('muestra el mismo mensaje de confirmación cuando la cuenta existe', async () => {
    authApi.forgotPassword.mockReturnValue(of(undefined));
    await renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

    expect(authApi.forgotPassword).toHaveBeenCalledWith('demo@ewcontrol.local');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si existe una cuenta con ese email',
    );
  });

  it('muestra el mismo mensaje de confirmación aunque la cuenta no exista (respuesta 202 siempre)', async () => {
    authApi.forgotPassword.mockReturnValue(of(undefined));
    await renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'inexistente@ewcontrol.local');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si existe una cuenta con ese email',
    );
  });

  it('muestra el mismo mensaje de confirmación incluso si la petición falla (red/servidor)', async () => {
    authApi.forgotPassword.mockReturnValue(throwError(() => ({ status: 500 })));
    await renderPage();

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace de recuperación' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si existe una cuenta con ese email',
    );
  });
});

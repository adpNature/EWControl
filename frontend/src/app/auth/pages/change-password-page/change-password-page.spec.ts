import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthApiService } from '../../adapters/auth-api.service';
import { ChangePasswordPage } from './change-password-page';

describe('ChangePasswordPage', () => {
  let authApi: { changePassword: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authApi = { changePassword: vi.fn() };
    toastService = { show: vi.fn() };
  });

  function renderPage() {
    return render(ChangePasswordPage, {
      providers: [
        { provide: AuthApiService, useValue: authApi },
        { provide: ToastService, useValue: toastService },
      ],
    });
  }

  it('no llama a changePassword si el formulario es inválido', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(authApi.changePassword).not.toHaveBeenCalled();
    expect(screen.getByText('La contraseña actual es obligatoria.')).toBeInTheDocument();
  });

  it('en éxito muestra confirmación y limpia el formulario', async () => {
    authApi.changePassword.mockReturnValue(of(undefined));
    await renderPage();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'Demo1234!');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(authApi.changePassword).toHaveBeenCalledWith('Demo1234!', 'Nueva1234!');
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Contraseña actualizada.',
    });
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('muestra el error de CURRENT_PASSWORD_INVALID asociado a la contraseña actual', async () => {
    authApi.changePassword.mockReturnValue(
      throwError(() => ({ status: 422, code: 'CURRENT_PASSWORD_INVALID', message: 'irrelevante' })),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Contraseña actual'), 'mala');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'Nueva1234!');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('actual');
  });
});

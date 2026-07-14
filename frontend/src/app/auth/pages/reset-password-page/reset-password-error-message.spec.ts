import { resetPasswordErrorMessage } from './reset-password-error-message';

describe('resetPasswordErrorMessage', () => {
  it('mapea INVALID_RESET_TOKEN a un mensaje sobre el enlace caducado', () => {
    expect(
      resetPasswordErrorMessage({ status: 401, code: 'INVALID_RESET_TOKEN', message: 'x' }),
    ).toContain('enlace');
  });

  it('mapea un 400 (política de contraseña) a un mensaje sobre la contraseña', () => {
    expect(resetPasswordErrorMessage({ status: 400, code: 'BAD_REQUEST', message: 'x' })).toContain(
      'contraseña',
    );
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    expect(resetPasswordErrorMessage({ status: 500, code: 'OTHER', message: 'x' })).toBe(
      'No se ha podido restablecer la contraseña. Inténtalo de nuevo.',
    );
  });
});

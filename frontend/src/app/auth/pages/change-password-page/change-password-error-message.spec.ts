import { changePasswordErrorMessage } from './change-password-error-message';

describe('changePasswordErrorMessage', () => {
  it('mapea CURRENT_PASSWORD_INVALID a un mensaje sobre la contraseña actual', () => {
    expect(
      changePasswordErrorMessage({ status: 422, code: 'CURRENT_PASSWORD_INVALID', message: 'x' }),
    ).toContain('actual');
  });

  it('mapea un 400 (política de contraseña) a un mensaje sobre la nueva contraseña', () => {
    expect(
      changePasswordErrorMessage({ status: 400, code: 'BAD_REQUEST', message: 'x' }),
    ).toContain('nueva contraseña');
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    expect(changePasswordErrorMessage({ status: 500, code: 'OTHER', message: 'x' })).toBe(
      'No se ha podido cambiar la contraseña. Inténtalo de nuevo.',
    );
  });
});

import { forgotPasswordErrorMessage } from './forgot-password-error-message';

describe('forgotPasswordErrorMessage', () => {
  it('mapea 429 a un mensaje de límite de solicitudes', () => {
    expect(
      forgotPasswordErrorMessage({ status: 429, code: 'TOO_MANY_REQUESTS', message: 'x' }),
    ).toBe('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.');
  });

  it('devuelve null para cualquier otro error (se mantiene la confirmación genérica anti-enumeración)', () => {
    expect(forgotPasswordErrorMessage({ status: 500, code: 'OTHER', message: 'x' })).toBeNull();
  });
});

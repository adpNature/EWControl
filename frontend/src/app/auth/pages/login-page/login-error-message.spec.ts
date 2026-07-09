import { ApiError } from '../../../core/http/api-error.model';
import { loginErrorMessage } from './login-error-message';

function apiError(status: number): ApiError {
  return { status, code: 'X', message: 'irrelevante' };
}

describe('loginErrorMessage', () => {
  it('devuelve el mismo mensaje genérico para 401, sin distinguir la causa', () => {
    expect(loginErrorMessage(apiError(401))).toBe('Email o contraseña incorrectos.');
  });

  it('devuelve un mensaje de espera para 429', () => {
    expect(loginErrorMessage(apiError(429))).toBe(
      'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
    );
  });

  it('devuelve un mensaje genérico de fallback para cualquier otro error', () => {
    expect(loginErrorMessage(apiError(500))).toBe(
      'No se ha podido iniciar sesión. Inténtalo de nuevo.',
    );
  });
});

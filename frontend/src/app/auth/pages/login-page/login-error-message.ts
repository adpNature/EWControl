import { ApiError } from '../../../core/http/api-error.model';

const INVALID_CREDENTIALS_MESSAGE = 'Email o contraseña incorrectos.';
const TOO_MANY_REQUESTS_MESSAGE = 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido iniciar sesión. Inténtalo de nuevo.';

/**
 * docs/specs/05-auth-login.md, criterios de aceptación frontend 5 y 6: el
 * mensaje de credenciales inválidas es el mismo tanto si el email no existe
 * como si la contraseña es incorrecta (ambos casos llegan como `401` desde
 * el Backend, que ya evita esa distinción por diseño anti-enumeración).
 */
export function loginErrorMessage(error: ApiError): string {
  if (error.status === 401) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (error.status === 429) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

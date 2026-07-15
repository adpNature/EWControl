import { ApiError } from '../../../core/http/api-error.model';

const INVALID_TOKEN_MESSAGE =
  'Este enlace ya no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".';
const WEAK_PASSWORD_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, con una letra y un número.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido restablecer la contraseña. Inténtalo de nuevo.';

/** docs/specs/10-gestion-companies-users.md, casos borde de UI. */
export function resetPasswordErrorMessage(error: ApiError): string {
  if (error.code === 'INVALID_RESET_TOKEN') {
    return INVALID_TOKEN_MESSAGE;
  }
  if (error.status === 400) {
    return WEAK_PASSWORD_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

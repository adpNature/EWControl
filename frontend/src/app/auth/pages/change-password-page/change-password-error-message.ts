import { ApiError } from '../../../core/http/api-error.model';

const CURRENT_PASSWORD_INVALID_MESSAGE = 'La contraseña actual no es correcta.';
const WEAK_PASSWORD_MESSAGE =
  'La nueva contraseña debe tener al menos 8 caracteres, con una letra y un número.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido cambiar la contraseña. Inténtalo de nuevo.';

/** docs/specs/10-gestion-companies-users.md, criterio de aceptación frontend 4. */
export function changePasswordErrorMessage(error: ApiError): string {
  if (error.code === 'CURRENT_PASSWORD_INVALID') {
    return CURRENT_PASSWORD_INVALID_MESSAGE;
  }
  if (error.status === 400) {
    return WEAK_PASSWORD_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

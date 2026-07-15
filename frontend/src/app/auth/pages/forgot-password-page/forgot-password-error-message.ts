import { ApiError } from '../../../core/http/api-error.model';

const TOO_MANY_REQUESTS_MESSAGE = 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';

/**
 * docs/specs/10-gestion-companies-users.md: un 429 no depende de si la
 * cuenta existe (el rate limit cuenta por email solicitado, no por
 * existencia), así que es el único caso que rompe el mensaje de
 * confirmación genérico (criterio de aceptación frontend 6) sin
 * reintroducir enumeración (OWASP A07) — cualquier otro error sigue
 * mostrando la confirmación.
 */
export function forgotPasswordErrorMessage(error: ApiError): string | null {
  if (error.status === 429) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
  return null;
}

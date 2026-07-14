import { ApiError } from '../../../core/http/api-error.model';

const COMPANY_NOT_FOUND_MESSAGE = 'No existe esta Company; puede que ya se haya eliminado.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido guardar la Company. Inténtalo de nuevo.';

/** docs/specs/10-gestion-companies-users.md. */
export function companyFormErrorMessage(error: ApiError): string {
  if (error.code === 'COMPANY_NOT_FOUND') {
    return COMPANY_NOT_FOUND_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

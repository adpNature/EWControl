import { ApiError } from '../../../core/http/api-error.model';

const EMAIL_ALREADY_EXISTS_MESSAGE = 'Ya existe un User con ese email.';
const FORBIDDEN_MESSAGE = 'No tienes permiso para crear o ascender un User a SuperAdmin.';
const COMPANY_ID_REQUIRED_MESSAGE = 'Debes seleccionar una Company.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido guardar el User. Inténtalo de nuevo.';

/** docs/specs/10-gestion-companies-users.md. */
export function userFormErrorMessage(error: ApiError): string {
  if (error.code === 'EMAIL_ALREADY_EXISTS') {
    return EMAIL_ALREADY_EXISTS_MESSAGE;
  }
  if (error.code === 'FORBIDDEN') {
    return FORBIDDEN_MESSAGE;
  }
  if (error.code === 'COMPANY_ID_REQUIRED') {
    return COMPANY_ID_REQUIRED_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

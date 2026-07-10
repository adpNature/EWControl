import { ApiError } from '../../../core/http/api-error.model';

const MACHINE_INACTIVE_MESSAGE = 'Esta Machine está desactivada; no se pueden guardar cambios.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido guardar la Machine. Inténtalo de nuevo.';

/** docs/specs/06-gestion-machines-signals.md, criterio de aceptación frontend 3. */
export function machineFormErrorMessage(error: ApiError): string {
  if (error.code === 'MACHINE_INACTIVE') {
    return MACHINE_INACTIVE_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

import { ApiError } from '../../../core/http/api-error.model';

const NOT_FOUND_MESSAGE =
  'Esta Signal o esta regla ya no existe. Vuelve atrás e inténtalo de nuevo.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido guardar la regla de alarma. Inténtalo de nuevo.';

/** docs/specs/09-alarmas.md: mapeo de errores del formulario de AlarmDefinition. */
export function alarmDefinitionFormErrorMessage(error: ApiError): string {
  if (error.code === 'SIGNAL_NOT_FOUND' || error.code === 'ALARM_DEFINITION_NOT_FOUND') {
    return NOT_FOUND_MESSAGE;
  }
  return GENERIC_FALLBACK_MESSAGE;
}

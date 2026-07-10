import { ApiError } from '../../../core/http/api-error.model';

export interface SignalFormErrorMapping {
  field: 'variables' | null;
  message: string;
}

const FORMULA_UNKNOWN_VARIABLE_MESSAGE =
  'La fórmula referencia una variable que no existe en esta Machine.';
const MACHINE_INACTIVE_MESSAGE =
  'Esta Machine está desactivada; no se pueden crear ni editar Signals.';
const GENERIC_FALLBACK_MESSAGE = 'No se ha podido guardar la Signal. Inténtalo de nuevo.';

/**
 * docs/specs/06-gestion-machines-signals.md, criterio de aceptación frontend 3:
 * el error de variable desconocida se asocia al campo `variables`, sin cerrar
 * el formulario ni perder los datos ya introducidos.
 */
export function signalFormErrorMessage(error: ApiError): SignalFormErrorMapping {
  if (error.code === 'FORMULA_REFERENCES_UNKNOWN_VARIABLE') {
    return { field: 'variables', message: FORMULA_UNKNOWN_VARIABLE_MESSAGE };
  }
  if (error.code === 'MACHINE_INACTIVE') {
    return { field: null, message: MACHINE_INACTIVE_MESSAGE };
  }
  return { field: null, message: GENERIC_FALLBACK_MESSAGE };
}

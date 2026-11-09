import { ApiError } from '../../core/http/api-error.model';
import {
  OpcUaVariableInUse,
  OpcUaVariableSyncResult,
  OpcUaVariableSyncSummary,
  SaveOpcUaVariablesRequest,
  SkippedOpcUaVariable,
  SyncedVariableStatus,
} from '../entities/machine-connection.model';
import { VARIABLE_NAME_PATTERN } from './opc-ua-mapping';

/**
 * Reglas de la pantalla «Variables OPC UA»
 * (docs/specs/21-sincronizacion-variables-opc-ua.md): funciones puras, sin Angular.
 */

/** Fila editable del listado: una variable mapeable del PLC con su identificador y etiqueta. */
export interface VariableRow {
  nodeId: string;
  path: string[];
  /** Ruta sin la carpeta raíz y sin repetir el nombre del array en sus elementos. */
  displayPath: string;
  dataType: string;
  /** Tipo guardado, solo en las filas `typeChanged`. */
  previousDataType: string | null;
  plcWritable: boolean;
  status: SyncedVariableStatus;
  /** Identificador guardado; con él llegan los usos de un `409 OPCUA_VARIABLE_IN_USE`. */
  savedName: string | null;
  signalVariableName: string;
  label: string;
}

export type StatusFilter = 'all' | 'new' | 'typeChanged' | 'removed';
export interface RowFilters {
  status: StatusFilter;
  /** Tipo OPC UA; vacío = todos. */
  dataType: string;
  text: string;
}

export type RowError = 'empty' | 'invalid' | 'duplicated';

const MAX_IDENTIFIER_LENGTH = 100;

/** Tabla de la spec 21: tipo OPC UA → tipo IEC 61131-3. */
const PLC_TYPE_LABELS: ReadonlyMap<string, string> = new Map([
  ['Boolean', 'BOOL'],
  ['SByte', 'SINT'],
  ['Byte', 'USINT'],
  ['Int16', 'INT'],
  ['UInt16', 'UINT'],
  ['Int32', 'DINT'],
  ['UInt32', 'UDINT'],
  ['Float', 'REAL'],
  ['Double', 'LREAL'],
  ['String', 'STRING'],
]);

/** Tipo de PLC de un tipo OPC UA; los que no están en la tabla se muestran tal cual. */
export function plcTypeLabel(dataType: string | null | undefined): string {
  if (!dataType) {
    return '—';
  }
  return PLC_TYPE_LABELS.get(dataType) ?? dataType;
}

/**
 * Segmentos de ruta sin repetir el nombre del array: en CODESYS los elementos
 * se llaman `x[0]` y cuelgan de `x`, así que `x` sobra.
 */
function collapseSegments(path: readonly string[]): string[] {
  const segments: string[] = [];
  for (const segment of path) {
    const previous = segments.at(-1);
    if (previous !== undefined && segment.startsWith(`${previous}[`)) {
      segments[segments.length - 1] = segment;
    } else {
      segments.push(segment);
    }
  }
  return segments;
}

/** Ruta legible sin la carpeta raíz: `asCtrl[0]`, `Ajustes.rVelocidad`. */
export function displayPath(path: readonly string[]): string {
  return collapseSegments(path).slice(1).join('.');
}

/**
 * Identificador por defecto (spec 21): la ruta desde la carpeta raíz, incluida,
 * saneada como identificador del motor de fórmulas.
 * `['GVL_HMI', 'asCtrl', 'asCtrl[0]']` → `GVL_HMI_asCtrl_0`.
 */
export function deriveIdentifierFromPath(path: readonly string[]): string {
  const sanitized = collapseSegments(path)
    .join('_')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return /^[0-9]/.test(sanitized) ? `_${sanitized}` : sanitized;
}

export function toVariableRows(result: OpcUaVariableSyncResult): VariableRow[] {
  return result.variables.map((variable) => ({
    nodeId: variable.nodeId,
    path: variable.path,
    displayPath: displayPath(variable.path),
    dataType: variable.dataType,
    previousDataType: variable.status === 'typeChanged' ? (variable.saved?.dataType ?? null) : null,
    plcWritable: variable.plcWritable,
    status: variable.status,
    savedName: variable.saved?.signalVariableName ?? null,
    signalVariableName:
      variable.saved?.signalVariableName ?? deriveIdentifierFromPath(variable.path),
    label: variable.saved?.label ?? '',
  }));
}

/** Filtros combinados; solo ocultan filas, no cambian lo editado. */
export function filterRows(rows: readonly VariableRow[], filters: RowFilters): VariableRow[] {
  if (filters.status === 'removed') {
    return [];
  }
  const text = filters.text.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (filters.status === 'all' || row.status === filters.status) &&
      (filters.dataType === '' || row.dataType === filters.dataType) &&
      (text === '' ||
        [row.displayPath, row.signalVariableName, row.label].some((value) =>
          value.toLowerCase().includes(text),
        )),
  );
}

/** Opciones del filtro por tipo: «BOOL (264)», de más a menos frecuente. */
export function typeFilterOptions(
  byDataType: Record<string, number>,
): { value: string; label: string }[] {
  return Object.entries(byDataType)
    .sort(([, a], [, b]) => b - a)
    .map(([dataType, count]) => ({
      value: dataType,
      label: `${plcTypeLabel(dataType)} (${count})`,
    }));
}

/**
 * Errores por fila, indexados por `nodeId`. `otherNames` son los identificadores
 * del resto del mapeo de la Machine, que también cuentan para los repetidos.
 */
export function validateRows(
  rows: readonly VariableRow[],
  otherNames: readonly string[],
): Map<string, RowError> {
  const counts = new Map<string, number>();
  for (const name of [...rows.map((row) => row.signalVariableName), ...otherNames]) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const errors = new Map<string, RowError>();
  for (const row of rows) {
    const name = row.signalVariableName;
    if (name.trim() === '') {
      errors.set(row.nodeId, 'empty');
    } else if (!VARIABLE_NAME_PATTERN.test(name) || name.length > MAX_IDENTIFIER_LENGTH) {
      errors.set(row.nodeId, 'invalid');
    } else if ((counts.get(name) ?? 0) > 1) {
      errors.set(row.nodeId, 'duplicated');
    }
  }
  return errors;
}

export const ROW_ERROR_MESSAGES: Record<RowError, string> = {
  empty: 'El identificador es obligatorio.',
  invalid: 'Solo letras, números y _, sin empezar por número (máx. 100).',
  duplicated: 'Identificador repetido.',
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** «3 nuevas · 1 eliminada · 2 con tipo cambiado», o «Sin cambios respecto a lo guardado». */
export function summaryChangesText(summary: OpcUaVariableSyncSummary): string {
  const parts: string[] = [];
  if (summary.new > 0) parts.push(plural(summary.new, 'nueva', 'nuevas'));
  if (summary.removed > 0) parts.push(plural(summary.removed, 'eliminada', 'eliminadas'));
  if (summary.typeChanged > 0) parts.push(`${summary.typeChanged} con tipo cambiado`);
  return parts.length === 0 ? 'Sin cambios respecto a lo guardado' : parts.join(' · ');
}

/** «460 variables · 30 omitidas». */
export function summaryCountsText(summary: OpcUaVariableSyncSummary): string {
  const parts = [plural(summary.total, 'variable', 'variables')];
  if (summary.skipped > 0) parts.push(plural(summary.skipped, 'omitida', 'omitidas'));
  return parts.join(' · ');
}

/** «BOOL 264 · REAL 91 · …», de más a menos frecuente. */
export function summaryTypesText(byDataType: Record<string, number>): string {
  return Object.entries(byDataType)
    .sort(([, a], [, b]) => b - a)
    .map(([dataType, count]) => `${plcTypeLabel(dataType)} ${count}`)
    .join(' · ');
}

/** Motivo legible de una variable omitida. */
export function skippedReasonText(variable: SkippedOpcUaVariable): string {
  const type = plcTypeLabel(variable.dataType);
  if (variable.reason === 'unsupportedType') {
    return `Tipo no soportado: ${type}`;
  }
  if (variable.arrayDimensions && variable.arrayDimensions.length > 0) {
    return `Array de ${type} [${variable.arrayDimensions.join(', ')}]`;
  }
  return `No escalar (${type})`;
}

export function buildSaveRequest(
  rootNodeId: string,
  rows: readonly VariableRow[],
  remove: readonly string[],
): SaveOpcUaVariablesRequest {
  return {
    rootNodeId,
    variables: rows.map((row) => ({
      nodeId: row.nodeId,
      signalVariableName: row.signalVariableName,
      label: row.label.trim() === '' ? null : row.label.trim(),
      dataType: row.dataType,
    })),
    remove: [...remove],
  };
}

/** Tras un guardado correcto, todo lo listado coincide con lo guardado. */
export function markRowsSaved(rows: readonly VariableRow[]): VariableRow[] {
  return rows.map((row) => ({
    ...row,
    status: 'unchanged',
    previousDataType: null,
    savedName: row.signalVariableName,
    label: row.label.trim(),
  }));
}

const GENERIC_MESSAGE = 'No se ha podido completar la operación. Inténtalo de nuevo.';

const COMMON_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['OPCUA_ENDPOINT_UNREACHABLE', 'No se ha podido conectar con la máquina.'],
  ['OPCUA_ENDPOINT_NOT_ALLOWED', 'El endpoint de la Machine no está permitido por el servidor.'],
  ['MACHINE_NOT_OPCUA', 'Esta Machine no está conectada por OPC UA.'],
  ['MACHINE_NOT_FOUND', 'La Machine no existe o no tienes acceso.'],
]);

const SYNC_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ...COMMON_ERROR_MESSAGES,
  ['OPCUA_SYNC_TIMEOUT', 'La máquina ha tardado demasiado en responder.'],
  ['OPCUA_INVALID_NODE_ID', 'La carpeta no existe en el servidor OPC UA.'],
  ['OPCUA_SYNC_TOO_MANY_NODES', 'La carpeta tiene más de 2.000 variables: elige una más concreta.'],
]);

const SAVE_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ...COMMON_ERROR_MESSAGES,
  ['OPCUA_VARIABLE_IN_USE', 'Hay variables en uso que no se pueden renombrar ni quitar.'],
  ['INVALID_CONNECTION_CONFIG', 'Hay identificadores no válidos o repetidos.'],
  ['OPCUA_INVALID_NODE_ID', 'La carpeta no es válida.'],
]);

export function syncErrorMessage(error: ApiError): string {
  return SYNC_ERROR_MESSAGES.get(error.code) ?? GENERIC_MESSAGE;
}

export function saveErrorMessage(error: ApiError): string {
  if (error.code === 'OPCUA_MAPPING_LIMIT') {
    const details = error.details as { resultingEntries?: number; maxEntries?: number } | undefined;
    return `El mapeo superaría el máximo de ${details?.maxEntries ?? 500} variables (${details?.resultingEntries ?? '?'}).`;
  }
  return SAVE_ERROR_MESSAGES.get(error.code) ?? GENERIC_MESSAGE;
}

/** Usos de un `409 OPCUA_VARIABLE_IN_USE`; vacío para cualquier otro error. */
export function parseVariablesInUse(error: ApiError): OpcUaVariableInUse[] {
  if (error.code !== 'OPCUA_VARIABLE_IN_USE') {
    return [];
  }
  const details = error.details as { variables?: OpcUaVariableInUse[] } | undefined;
  return Array.isArray(details?.variables) ? details.variables : [];
}

/** «Se usa en: Signal "Velocidad", Paquete "Formato 120"». */
export function usageText(variable: OpcUaVariableInUse): string {
  const uses = variable.usedBy.map(
    (use) => `${use.kind === 'Signal' ? 'Signal' : 'Paquete'} "${use.name}"`,
  );
  return `Se usa en: ${uses.join(', ')}`;
}

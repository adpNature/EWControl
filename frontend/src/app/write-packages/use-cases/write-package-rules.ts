import { ApiError } from '../../core/http/api-error.model';
import { OpcUaNodeMapping } from '../../config/entities/machine-connection.model';
import {
  WritePackageExecutionStatus,
  WritePackageList,
  WriteValue,
} from '../entities/write-package.model';

/**
 * Reglas de presentación de docs/specs/20-paquetes-escritura-opc-ua.md. El
 * Backend es la autoridad final (revalida tipo y límites en el alta y al
 * ejecutar); aquí solo se evita enviar valores que seguro va a rechazar.
 */
export const WRITABLE_DATA_TYPES: readonly string[] = [
  'Boolean',
  'SByte',
  'Byte',
  'Int16',
  'UInt16',
  'Int32',
  'UInt32',
  'Float',
  'Double',
  'String',
];

const INTEGER_RANGES: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['SByte', [-128, 127]],
  ['Byte', [0, 255]],
  ['Int16', [-32768, 32767]],
  ['UInt16', [0, 65535]],
  ['Int32', [-2147483648, 2147483647]],
  ['UInt32', [0, 4294967295]],
]);

export function isWritableDataType(dataType: string | undefined): boolean {
  return !!dataType && WRITABLE_DATA_TYPES.includes(dataType);
}

export function isNumericDataType(dataType: string | undefined): boolean {
  return isWritableDataType(dataType) && dataType !== 'Boolean' && dataType !== 'String';
}

/** Variables marcadas como escribibles en el `nodeMapping` de la Machine. */
export function writableVariables(
  nodeMapping: readonly OpcUaNodeMapping[],
): (OpcUaNodeMapping & { dataType: string })[] {
  return nodeMapping.filter(
    (entry): entry is OpcUaNodeMapping & { dataType: string } =>
      !!entry.writable && isWritableDataType(entry.dataType),
  );
}

/** Mensaje de error de un valor, o `null` si es válido para el tipo y límites de la variable. */
export function writeValueError(
  variable: { dataType: string; min?: number; max?: number },
  value: WriteValue | null,
): string | null {
  if (variable.dataType === 'Boolean') {
    return typeof value === 'boolean' ? null : 'Elige verdadero o falso.';
  }
  if (variable.dataType === 'String') {
    return typeof value === 'string' && value.length <= 256 ? null : 'Máximo 256 caracteres.';
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Introduce un número.';
  }
  const range = INTEGER_RANGES.get(variable.dataType);
  if (range && (!Number.isInteger(value) || value < range[0] || value > range[1])) {
    return `Entero entre ${range[0]} y ${range[1]}.`;
  }
  if (variable.min !== undefined && value < variable.min) {
    return `Mínimo ${variable.min}.`;
  }
  if (variable.max !== undefined && value > variable.max) {
    return `Máximo ${variable.max}.`;
  }
  return null;
}

/** Convierte lo escrito en un `<input>` al valor del tipo de la variable. */
export function parseInputValue(dataType: string, raw: string | boolean): WriteValue | null {
  if (dataType === 'Boolean') {
    return typeof raw === 'boolean' ? raw : raw === 'true';
  }
  if (dataType === 'String') {
    return String(raw);
  }
  const text = String(raw).trim().replace(',', '.');
  return text === '' ? null : Number(text);
}

export function formatWriteValue(value: WriteValue): string {
  if (typeof value === 'boolean') {
    return value ? 'Verdadero' : 'Falso';
  }
  return String(value);
}

const STATUS_LABELS: ReadonlyMap<WritePackageExecutionStatus, string> = new Map([
  ['SUCCESS', 'Escrito correctamente'],
  ['PARTIAL', 'Escrito parcialmente'],
  ['FAILED', 'No se ha escrito'],
]);

export function executionStatusLabel(status: WritePackageExecutionStatus): string {
  return STATUS_LABELS.get(status) ?? status;
}

const STATUS_CODE_LABELS: ReadonlyMap<string, string> = new Map([
  ['Good', 'Escrito'],
  ['NOT_SENT', 'No enviado'],
  ['TIMEOUT', 'Sin respuesta del PLC'],
  ['BadTypeMismatch', 'Tipo distinto en el PLC'],
  ['BadNotWritable', 'El PLC no permite escribir esta variable'],
  ['BadUserAccessDenied', 'El PLC ha denegado la escritura'],
  ['BadOutOfRange', 'Valor fuera de rango para el PLC'],
  ['BadNodeIdUnknown', 'La variable no existe en el PLC'],
]);

/** `StatusCode` OPC UA de un elemento traducido para el usuario. */
export function statusCodeLabel(statusCode: string): string {
  return STATUS_CODE_LABELS.get(statusCode) ?? `Error del PLC (${statusCode})`;
}

const REASON_LABELS: ReadonlyMap<string, string> = new Map([
  [
    'WRITE_PACKAGE_OUTDATED',
    'El paquete ya no es válido con la configuración actual de la Machine.',
  ],
  ['MACHINE_NOT_CONNECTED', 'La Machine no está conectada a su PLC.'],
  ['WRITE_IN_PROGRESS', 'Ya había otra escritura en curso en esta Machine.'],
  ['PROVIDER_NOT_SUPPORTED', 'Esta Machine no admite escritura (no es OPC UA).'],
  [
    'TIMEOUT',
    'El PLC no respondió a tiempo: algún valor pudo llegar a escribirse. Compruébalo antes de repetir.',
  ],
]);

export function executionReasonLabel(reason: string | null): string | null {
  return reason ? (REASON_LABELS.get(reason) ?? reason) : null;
}

const API_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  [
    'WRITE_PACKAGE_OUTDATED',
    'El paquete ya no es válido: revisa sus valores con un administrador.',
  ],
  ['MACHINE_NOT_CONNECTED', 'La Machine no está conectada a su PLC. No se ha escrito nada.'],
  ['WRITE_IN_PROGRESS', 'Hay otra escritura en curso en esta Machine. Inténtalo en unos segundos.'],
  ['PROVIDER_NOT_SUPPORTED', 'Esta Machine no admite escritura (no es OPC UA).'],
  ['WRITE_PACKAGE_NOT_FOUND', 'El paquete ya no existe.'],
  ['WRITE_PACKAGE_NAME_TAKEN', 'Ya existe un paquete con ese nombre en esta Machine.'],
  ['MACHINE_NOT_FOUND', 'La Machine no existe.'],
]);

/** Mensaje de un error de la API de paquetes (spec 20, "Casos borde / errores de UI"). */
export function writePackageErrorMessage(error: ApiError): string {
  if (error.code === 'INVALID_WRITE_PACKAGE') {
    const details = error.details as { reason?: string } | undefined;
    return `El paquete no es válido: ${details?.reason ?? error.message}.`;
  }
  return API_ERROR_MESSAGES.get(error.code) ?? 'No se ha podido completar la operación.';
}

/**
 * Criterio frontend 6: por qué no se puede ejecutar ahora un paquete de esta
 * Machine, o `null` si se puede. Lo comparten la página "Paquetes" y el widget.
 */
export function executionDisabledReason(list: WritePackageList | null): string | null {
  if (!list) {
    return null;
  }
  if (list.providerType !== 'OpcUa') {
    return 'Esta Machine no admite escritura (no es OPC UA).';
  }
  return list.connected ? null : 'La Machine no está conectada a su PLC.';
}

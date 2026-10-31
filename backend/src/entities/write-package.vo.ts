import {
  type ConnectionConfig,
  isNumericDataType,
  isOpcUaConnectionConfig,
  type OpcUaNodeMapping,
} from './connection-config.vo';
import { WritePackageExecutionStatus } from './write-package-execution-status.enum';

/** Valor fijo que un paquete escribe en una variable (receta cerrada, spec 20). */
export type WriteValue = number | boolean | string;

export type WritePackageItem = { signalVariableName: string; value: WriteValue };

export type ValidationResult = { ok: true } | { ok: false; reason: string };
export type ItemsValidationResult = { ok: true } | { ok: false; reason: string; index: number };

const INTEGER_RANGES: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['SByte', [-128, 127]],
  ['Byte', [0, 255]],
  ['Int16', [-32768, 32767]],
  ['UInt16', [0, 65535]],
  ['Int32', [-2147483648, 2147483647]],
  ['UInt32', [0, 4294967295]],
]);
const FLOAT32_MAX = 3.4028234663852886e38;
const MAX_STRING_LENGTH = 256;
const MAX_ITEMS = 50;

/**
 * Valida un valor contra el tipo OPC UA de su variable y sus límites
 * opcionales (spec 20, "Casos borde": `"abc"` para un `Float`, `3.5` o
 * `40000` para un `Int16`...). Se usa al guardar el paquete y al ejecutarlo.
 */
export function validateWriteValue(
  variable: { dataType: string; min?: number; max?: number },
  value: unknown,
): ValidationResult {
  const { dataType } = variable;
  if (dataType === 'Boolean') {
    return typeof value === 'boolean' ? { ok: true } : fail(`debe ser un booleano (${dataType})`);
  }
  if (dataType === 'String') {
    return typeof value === 'string' && value.length <= MAX_STRING_LENGTH
      ? { ok: true }
      : fail(`debe ser un texto de hasta ${MAX_STRING_LENGTH} caracteres (${dataType})`);
  }
  if (!isNumericDataType(dataType)) {
    return fail(`el tipo ${dataType} no se puede escribir`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(`debe ser un número (${dataType})`);
  }
  const integerRange = INTEGER_RANGES.get(dataType);
  if (integerRange) {
    const [min, max] = integerRange;
    if (!Number.isInteger(value) || value < min || value > max) {
      return fail(`debe ser un entero entre ${min} y ${max} (${dataType})`);
    }
  } else if (dataType === 'Float' && Math.abs(value) > FLOAT32_MAX) {
    return fail(`está fuera del rango de un ${dataType}`);
  }
  if (variable.min !== undefined && value < variable.min) {
    return fail(`es menor que el mínimo permitido (${variable.min})`);
  }
  if (variable.max !== undefined && value > variable.max) {
    return fail(`es mayor que el máximo permitido (${variable.max})`);
  }
  return { ok: true };
}

/** Variable mapeada y marcada como escribible, o `undefined` si no existe o no lo es. */
export function findWritableVariable(
  config: ConnectionConfig,
  signalVariableName: string,
): (OpcUaNodeMapping & { dataType: string }) | undefined {
  if (!isOpcUaConnectionConfig(config)) {
    return undefined;
  }
  const entry = config.nodeMapping.find(
    (candidate) => candidate.signalVariableName === signalVariableName,
  );
  return entry?.writable && entry.dataType
    ? (entry as OpcUaNodeMapping & { dataType: string })
    : undefined;
}

/**
 * Valida los elementos de un paquete contra la config de conexión **actual**
 * (spec 20, criterios backend 2 y 5): 1-50 elementos, sin variables repetidas,
 * todas escribibles y con valores válidos. Devuelve el primer elemento inválido.
 */
export function validateWritePackageItems(
  items: readonly WritePackageItem[],
  config: ConnectionConfig,
): ItemsValidationResult {
  if (items.length === 0 || items.length > MAX_ITEMS) {
    return { ok: false, index: 0, reason: `debe tener entre 1 y ${MAX_ITEMS} elementos` };
  }
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.signalVariableName)) {
      return { ok: false, index, reason: `la variable ${item.signalVariableName} está repetida` };
    }
    seen.add(item.signalVariableName);
    const variable = findWritableVariable(config, item.signalVariableName);
    if (!variable) {
      return {
        ok: false,
        index,
        reason: `la variable ${item.signalVariableName} no es escribible en esta Machine`,
      };
    }
    const valueResult = validateWriteValue(variable, item.value);
    if (!valueResult.ok) {
      return {
        ok: false,
        index,
        reason: `el valor de ${item.signalVariableName} ${valueResult.reason}`,
      };
    }
  }
  return { ok: true };
}

/** Resultado global a partir del `StatusCode` de cada elemento (spec 20, criterio backend 7). */
export function executionStatusFrom(statusCodes: readonly string[]): WritePackageExecutionStatus {
  const good = statusCodes.filter((code) => code === 'Good').length;
  if (good > 0 && good === statusCodes.length) {
    return WritePackageExecutionStatus.Success;
  }
  return good > 0 ? WritePackageExecutionStatus.Partial : WritePackageExecutionStatus.Failed;
}

function fail(reason: string): ValidationResult {
  return { ok: false, reason };
}

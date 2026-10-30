import { DataType, type DataValue, type NodeId, VariantArrayType } from 'node-opcua-client';
import type { OpcUaConnectionTestFailureReason } from '../../../use-cases/machine-management/ports/opc-ua-explorer.port';
import type { OpcUaDataChange, OpcUaSeverity } from './opc-ua-driver.port';

/** Error propio para distinguir un vencimiento de `timeoutMs` del resto de fallos de red. */
export class OpcUaTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Sin respuesta del servidor OPC UA en ${timeoutMs} ms.`);
    this.name = 'OpcUaTimeoutError';
  }
}

/** Severidad según los dos bits altos del `StatusCode` (OPC UA Part 4, 7.34): 00 Good, 01 Uncertain, 1x Bad. */
export function severityOf(statusCodeValue: number): OpcUaSeverity {
  const severityBits = statusCodeValue >>> 30;
  if (severityBits === 0) {
    return 'Good';
  }
  return severityBits === 1 ? 'Uncertain' : 'Bad';
}

/** Convierte un `DataValue` de node-opcua en una `OpcUaDataChange` sin tipos de la librería. */
export function toDataChange(nodeId: string, dataValue: DataValue): OpcUaDataChange {
  const variant = dataValue.value;
  const hasValue = variant !== null && variant !== undefined && variant.dataType !== DataType.Null;
  return {
    nodeId,
    value: hasValue ? (variant.value as unknown) : null,
    builtInType: hasValue ? DataType[variant.dataType] : 'Null',
    isArray: hasValue && variant.arrayType !== VariantArrayType.Scalar,
    severity: severityOf(dataValue.statusCode.value),
    statusCodeName: dataValue.statusCode.name,
  };
}

/**
 * Nombre legible de un `DataType`: los tipos estándar (`ns=0`, numéricos) se
 * traducen a su nombre (`Double`, `Boolean`...); el resto se devuelve como NodeId
 * para que el explorador lo resuelva por su `BrowseName`.
 */
export function standardDataTypeName(dataTypeNodeId: NodeId): string | undefined {
  if (dataTypeNodeId.namespace !== 0 || typeof dataTypeNodeId.value !== 'number') {
    return undefined;
  }
  return DataType[dataTypeNodeId.value];
}

/**
 * Motivo genérico de un fallo de conexión (spec 18, criterio backend 5): nunca
 * se devuelve el mensaje técnico de node-opcua, solo una de estas categorías.
 */
export function classifyConnectionError(error: unknown): OpcUaConnectionTestFailureReason {
  if (error instanceof OpcUaTimeoutError) {
    return 'TIMEOUT';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/BadSecurity|BadIdentityToken|BadUserAccessDenied|BadCertificate/i.test(message)) {
    return 'SECURITY_REJECTED';
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(message)) {
    return 'TIMEOUT';
  }
  return 'UNREACHABLE';
}

/**
 * Resuelve `work` o rechaza con `OpcUaTimeoutError` si tarda más de `timeoutMs`.
 * El rechazo tardío de `work` se silencia: quien llama ya cierra el cliente.
 */
export async function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OpcUaTimeoutError(timeoutMs)), timeoutMs);
  });
  work.catch(() => undefined);
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

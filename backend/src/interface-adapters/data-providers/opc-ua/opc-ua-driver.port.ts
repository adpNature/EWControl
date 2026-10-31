import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';

export const OPCUA_DRIVER_FACTORY = Symbol('OpcUaDriverFactory');

/** Severidad de un `StatusCode` OPC UA, según sus dos bits altos (OPC UA Part 4, 7.34). */
export type OpcUaSeverity = 'Good' | 'Uncertain' | 'Bad';

/** Notificación de cambio de valor de un MonitoredItem, ya despojada de tipos de node-opcua. */
export type OpcUaDataChange = {
  nodeId: string;
  /** Valor JS del `Variant`; `null` si la notificación no trae valor. */
  value: unknown;
  /** Nombre del `DataType` integrado del `Variant` (`Double`, `Boolean`, `Null`...). */
  builtInType: string;
  isArray: boolean;
  severity: OpcUaSeverity;
  statusCodeName: string;
};

/** Valor a escribir en un nodo (docs/specs/20-paquetes-escritura-opc-ua.md). */
export type OpcUaWriteItem = { nodeId: string; dataType: string; value: number | boolean | string };

/** `StatusCode` resultante de cada escritura, en el orden de la petición. */
export type OpcUaWriteResult = { nodeId: string; statusCode: string };

/** No hay sesión OPC UA activa con la que escribir (desconectado o detenido). */
export class OpcUaSessionUnavailableError extends Error {
  constructor() {
    super('No hay una sesión OPC UA activa.');
    this.name = 'OpcUaSessionUnavailableError';
  }
}

/** Eventos que el driver entrega al `OpcUaProvider`. */
export interface IOpcUaDriverListener {
  /** Sesión y Subscription operativas (primera conexión o tras reconectar). */
  onConnected(): void;
  /** Se ha perdido la conexión; el driver sigue reintentando por su cuenta. */
  onDisconnected(): void;
  onDataChange(change: OpcUaDataChange): void;
  /** El servidor rechazó crear el MonitoredItem de `nodeId` (p. ej. `BadNodeIdUnknown`). */
  onMonitoredItemRejected(nodeId: string, reason: string): void;
  /** Hora del servidor leída tras cada conexión, para detectar desfases de reloj. */
  onServerTime(serverTime: Date): void;
}

/**
 * Frontera entre el `OpcUaProvider` y la librería `node-opcua` (spec 18): todo
 * lo específico de la librería (sesión, Subscription, reconexión con backoff)
 * vive detrás de esta interfaz, de modo que el provider se prueba con fakes.
 */
export interface IOpcUaDriver {
  /** No bloquea: conecta en segundo plano y reintenta indefinidamente hasta `stop()`. */
  start(listener: IOpcUaDriverListener): void;
  /** Cierra Subscription, sesión y canal; tras resolverse no emite más eventos. */
  stop(): Promise<void>;
  /**
   * Escribe con la sesión abierta, todos los valores en una sola petición `Write`.
   * Un nodo cuyo tipo real no coincide con `dataType` no se envía (`BadTypeMismatch`).
   * @throws OpcUaSessionUnavailableError si no hay sesión.
   * @throws OpcUaTimeoutError si el servidor no responde en `timeoutMs`.
   */
  write(items: OpcUaWriteItem[]): Promise<OpcUaWriteResult[]>;
}

export type OpcUaDriverFactory = (config: OpcUaConnectionConfig) => IOpcUaDriver;

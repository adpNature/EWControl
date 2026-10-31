import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';
import type { IDataProvider, VariableListener } from '../data-provider';
import { DataQuality } from '../data-quality.enum';
import { VariableType } from '../variable-type.enum';
import type { Variable } from '../variable.vo';
import {
  type IOpcUaDriver,
  type IOpcUaDriverListener,
  type OpcUaDataChange,
  OpcUaSessionUnavailableError,
  type OpcUaSeverity,
  type OpcUaWriteItem,
  type OpcUaWriteResult,
} from './opc-ua-driver.port';

export type ConnectionChangeListener = (connected: boolean) => void;

/** Desfase de reloj a partir del cual se avisa (spec 18, "Casos borde"). */
const CLOCK_SKEW_WARNING_MS = 5 * 60 * 1000;

/** Tipos escalares soportados en esta spec, por nombre de `DataType` integrado de OPC UA. */
const VARIABLE_TYPE_BY_BUILT_IN_TYPE: ReadonlyMap<string, VariableType> = new Map([
  ['Boolean', VariableType.Boolean],
  ['SByte', VariableType.Integer],
  ['Byte', VariableType.Integer],
  ['Int16', VariableType.Integer],
  ['UInt16', VariableType.Integer],
  ['Int32', VariableType.Integer],
  ['UInt32', VariableType.Integer],
  ['Float', VariableType.Float],
  ['Double', VariableType.Float],
  ['String', VariableType.String],
]);

const DATA_QUALITY_BY_SEVERITY: ReadonlyMap<OpcUaSeverity, DataQuality> = new Map([
  ['Good', DataQuality.Good],
  ['Uncertain', DataQuality.Uncertain],
  ['Bad', DataQuality.Bad],
]);

type PublishedValue = { value: number | boolean | string; type: VariableType };
type LastPublished = PublishedValue & { name: string; quality: DataQuality };

/**
 * Data Provider OPC UA de producción (Documento 2, apartado "Data Provider";
 * docs/specs/18-integracion-opc-ua.md). Traduce las notificaciones de la
 * Subscription a `Variable`s: nombre según `nodeMapping`, tipo y calidad
 * traducidos, y `timestamp` del reloj del Backend (el reloj del PLC piloto no
 * es fiable). La sesión, la Subscription y la reconexión viven en el `IOpcUaDriver`.
 */
export class OpcUaProvider implements IDataProvider {
  private readonly logger = new Logger(OpcUaProvider.name);
  private readonly listeners = new Set<VariableListener>();
  private readonly connectionListeners = new Set<ConnectionChangeListener>();
  private readonly variableNameByNodeId: ReadonlyMap<string, string>;
  private readonly lastValueByNodeId = new Map<string, LastPublished>();
  private readonly discardWarnedNodeIds = new Set<string>();
  private started = false;
  private connected = false;

  constructor(
    private readonly machineId: string,
    config: OpcUaConnectionConfig,
    private readonly driver: IOpcUaDriver,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.variableNameByNodeId = new Map(
      config.nodeMapping.map((entry) => [entry.nodeId, entry.signalVariableName]),
    );
  }

  /** No espera a la conexión: el driver conecta y reintenta en segundo plano (spec 18, criterio 9). */
  async connect(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.driver.start(this.createDriverListener());
  }

  async disconnect(): Promise<void> {
    this.started = false;
    this.connected = false;
    await this.driver.stop();
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(listener: VariableListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: VariableListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Vuelve a publicar el último valor recibido de cada variable, con la hora
   * actual (spec 18). OPC UA solo notifica cambios: sin esto, una Signal creada
   * después de suscribirse no tendría valor hasta que el PLC cambie el suyo.
   */
  republishLastValues(): void {
    if (!this.started || !this.connected) {
      return;
    }
    for (const last of this.lastValueByNodeId.values()) {
      this.emit({
        name: last.name,
        value: last.value,
        type: last.type,
        timestamp: this.clock(),
        quality: last.quality,
        correlationId: randomUUID(),
      });
    }
  }

  /**
   * docs/specs/20-paquetes-escritura-opc-ua.md: escribe con la sesión abierta.
   * @throws OpcUaSessionUnavailableError si el provider no está conectado.
   */
  write(items: OpcUaWriteItem[]): Promise<OpcUaWriteResult[]> {
    if (!this.started || !this.connected) {
      return Promise.reject(new OpcUaSessionUnavailableError());
    }
    return this.driver.write(items);
  }

  /** Avisa de cada transición conectado/desconectado, para publicar `MachineConnected`/`MachineDisconnected`. */
  onConnectionChange(listener: ConnectionChangeListener): void {
    this.connectionListeners.add(listener);
  }

  private createDriverListener(): IOpcUaDriverListener {
    return {
      onConnected: () => this.whenStarted(() => this.setConnected(true)),
      onDisconnected: () => this.whenStarted(() => this.setConnected(false)),
      onDataChange: (change) => this.whenStarted(() => this.handleDataChange(change)),
      onMonitoredItemRejected: (nodeId, reason) =>
        this.whenStarted(() =>
          this.logger.warn(
            `Machine ${this.machineId}: el servidor OPC UA rechazó monitorizar ${nodeId} (${reason}).`,
          ),
        ),
      onServerTime: (serverTime) => this.whenStarted(() => this.checkClockSkew(serverTime)),
    };
  }

  private whenStarted(action: () => void): void {
    if (this.started) {
      action();
    }
  }

  private setConnected(connected: boolean): void {
    if (this.connected === connected) {
      return;
    }
    this.connected = connected;
    for (const listener of this.connectionListeners) {
      listener(connected);
    }
  }

  private handleDataChange(change: OpcUaDataChange): void {
    const name = this.variableNameByNodeId.get(change.nodeId);
    if (!name) {
      return;
    }
    const quality = DATA_QUALITY_BY_SEVERITY.get(change.severity) ?? DataQuality.Bad;
    const published = this.toPublishedValue(change);

    if (published === 'unsupported') {
      this.warnDiscardedOnce(change);
      return;
    }
    // Sin valor utilizable (p. ej. BadNoCommunication): se repite el último
    // valor con la calidad recibida; si nunca hubo uno, no se inventa.
    const value = published ?? this.lastValueByNodeId.get(change.nodeId);
    if (!value) {
      return;
    }
    this.lastValueByNodeId.set(change.nodeId, { ...value, name, quality });
    this.emit({
      name,
      value: value.value,
      type: value.type,
      timestamp: this.clock(),
      quality,
      correlationId: randomUUID(),
    });
  }

  /** `undefined` = sin valor; `'unsupported'` = tipo no escalar o no soportado. */
  private toPublishedValue(change: OpcUaDataChange): PublishedValue | undefined | 'unsupported' {
    if (change.value === null || change.value === undefined) {
      return undefined;
    }
    const type = VARIABLE_TYPE_BY_BUILT_IN_TYPE.get(change.builtInType);
    if (change.isArray || !type) {
      return 'unsupported';
    }
    if (typeof change.value === 'number' && !Number.isFinite(change.value)) {
      return undefined;
    }
    return { value: change.value as number | boolean | string, type };
  }

  private warnDiscardedOnce(change: OpcUaDataChange): void {
    if (this.discardWarnedNodeIds.has(change.nodeId)) {
      return;
    }
    this.discardWarnedNodeIds.add(change.nodeId);
    this.logger.warn(
      `Machine ${this.machineId}: se descartan los valores de ${change.nodeId} ` +
        `(${change.isArray ? 'array' : change.builtInType} no soportado).`,
    );
  }

  private checkClockSkew(serverTime: Date): void {
    const skewMs = serverTime.getTime() - this.clock().getTime();
    if (Math.abs(skewMs) <= CLOCK_SKEW_WARNING_MS) {
      return;
    }
    this.logger.warn(
      `Machine ${this.machineId}: el reloj del servidor OPC UA está desfasado ` +
        `${Math.round(skewMs / 1000)} s respecto al Backend (${serverTime.toISOString()}); ` +
        'se usa la hora de recepción del Backend como timestamp.',
    );
  }

  private emit(variable: Variable): void {
    for (const listener of this.listeners) {
      listener(variable);
    }
  }
}

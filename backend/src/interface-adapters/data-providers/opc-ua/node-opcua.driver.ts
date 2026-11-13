import { Logger } from '@nestjs/common';
import {
  AttributeIds,
  type ClientMonitoredItemBase,
  ClientMonitoredItemGroup,
  type ClientSession,
  ClientSubscription,
  DataType,
  type DataValue,
  MessageSecurityMode,
  type NodeId,
  OPCUAClient,
  resolveNodeId,
  SecurityPolicy,
  TimestampsToReturn,
  Variant,
} from 'node-opcua-client';
import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';
import { standardDataTypeName, toDataChange, withTimeout } from './node-opcua.mappers';
import {
  type IOpcUaDriver,
  type IOpcUaDriverListener,
  type OpcUaDriverFactory,
  OpcUaSessionUnavailableError,
  type OpcUaWriteItem,
  type OpcUaWriteResult,
} from './opc-ua-driver.port';
import {
  RECONNECTION_POLICY_DEFAULTS,
  ReconnectionPolicy,
  type ReconnectionPolicyOptions,
} from './reconnection-policy';

/** spec 18: reintento indefinido con backoff exponencial, máximo 30 s entre intentos. */
const RECONNECTION_STRATEGY = { maxRetry: -1, initialDelay: 1000, maxDelay: 30000 };
const SESSION_RETRY_MAX_DELAY_MS = 30000;
/** spec 24, criterio 3: MonitoredItems por petición `CreateMonitoredItems`. */
export const MONITORED_ITEMS_BATCH_SIZE = 100;
/** spec 24, criterio 5: tiempo máximo de cada paso del cierre. */
const CLOSE_STEP_TIMEOUT_MS = 2000;
const DISCONNECT_TIMEOUT_MS = 1000;
/** `Server_ServerStatus_CurrentTime` (OPC UA Part 5): solo para detectar desfases de reloj. */
const SERVER_CURRENT_TIME_NODE_ID = 'ns=0;i=2258';

/**
 * Implementación de `IOpcUaDriver` sobre `node-opcua-client` (spec 18). Una
 * sesión anónima sin cifrado con una única Subscription que monitoriza solo
 * los NodeIds indicados, creados por lotes (docs/specs/24-conexion-opc-ua-estable.md).
 * Una reconexión puntual la hace node-opcua; si la conexión se pierde demasiadas
 * veces seguidas, el driver cierra todo de forma explícita y espera una pausa
 * creciente (`ReconnectionPolicy`) antes de volver a conectar desde cero.
 */
export class NodeOpcUaDriver implements IOpcUaDriver {
  private readonly logger = new Logger(NodeOpcUaDriver.name);
  private client: OPCUAClient | undefined;
  private session: ClientSession | undefined;
  private subscription: ClientSubscription | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;
  private listener: IOpcUaDriverListener | undefined;
  private monitoredNodeIds: string[] = [];
  private readonly monitoredItems = new Map<string, ClientMonitoredItemBase>();
  private readonly policy: ReconnectionPolicy;

  /** `policyOptions` solo se cambia en tests; en producción, los valores de la spec 24. */
  constructor(
    private readonly config: OpcUaConnectionConfig,
    policyOptions: ReconnectionPolicyOptions = RECONNECTION_POLICY_DEFAULTS,
  ) {
    this.policy = new ReconnectionPolicy(Date.now, policyOptions);
  }

  start(listener: IOpcUaDriverListener, nodeIds: readonly string[]): void {
    this.stopped = false;
    this.listener = listener;
    this.monitoredNodeIds = [...nodeIds];
    void this.connectWithRetry(listener, 0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    await this.closeQuietly();
  }

  /** spec 24, criterio 2: añade y quita MonitoredItems en la Subscription actual. */
  async setMonitoredNodeIds(nodeIds: readonly string[]): Promise<void> {
    const wanted = new Set(nodeIds);
    const current = new Set(this.monitoredNodeIds);
    this.monitoredNodeIds = [...nodeIds];
    const subscription = this.subscription;
    const listener = this.listener;
    if (!subscription || !listener || this.stopped) {
      return;
    }
    const removed = [...current].filter((nodeId) => !wanted.has(nodeId));
    await Promise.all(
      removed.map(async (nodeId) => {
        const item = this.monitoredItems.get(nodeId);
        this.monitoredItems.delete(nodeId);
        await item?.terminate().catch(() => undefined);
      }),
    );
    const added = nodeIds.filter((nodeId) => !current.has(nodeId));
    await this.monitorInBatches(subscription, added, listener);
  }

  /** docs/specs/20-paquetes-escritura-opc-ua.md: escritura con la sesión de la Subscription. */
  async write(items: OpcUaWriteItem[]): Promise<OpcUaWriteResult[]> {
    const session = this.session;
    if (!session || this.stopped) {
      throw new OpcUaSessionUnavailableError();
    }
    return withTimeout(this.writeWithSession(session, items), this.config.timeoutMs);
  }

  private async writeWithSession(
    session: ClientSession,
    items: OpcUaWriteItem[],
  ): Promise<OpcUaWriteResult[]> {
    const results: OpcUaWriteResult[] = items.map((item) => ({
      nodeId: item.nodeId,
      statusCode: 'BadNodeIdInvalid',
    }));
    const resolved: { index: number; nodeId: NodeId }[] = [];
    items.forEach((item, index) => {
      try {
        resolved.push({ index, nodeId: resolveNodeId(item.nodeId) });
      } catch {
        // Queda como BadNodeIdInvalid, sin enviarse.
      }
    });
    if (resolved.length === 0) {
      return results;
    }

    // Se comprueba el tipo real del nodo antes de escribir: nunca se envía un
    // valor con un tipo distinto del que espera el PLC.
    const dataTypes = await session.read(
      resolved.map(({ nodeId }) => ({ nodeId, attributeId: AttributeIds.DataType })),
    );
    const toWrite: { index: number; nodeId: NodeId; variant: Variant }[] = [];
    resolved.forEach(({ index, nodeId }, position) => {
      const dataValue = dataTypes[position];
      if (!dataValue?.statusCode.isGood()) {
        results[index].statusCode = dataValue?.statusCode.name ?? 'BadNodeIdUnknown';
        return;
      }
      const actualType = standardDataTypeName(dataValue.value.value as NodeId);
      const item = items[index];
      if (actualType !== item.dataType) {
        results[index].statusCode = 'BadTypeMismatch';
        return;
      }
      toWrite.push({
        index,
        nodeId,
        variant: new Variant({
          dataType: DataType[item.dataType as keyof typeof DataType],
          value: item.value,
        }),
      });
    });
    if (toWrite.length === 0) {
      return results;
    }

    const statusCodes = await session.write(
      toWrite.map(({ nodeId, variant }) => ({
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: variant },
      })),
    );
    toWrite.forEach(({ index }, position) => {
      results[index].statusCode = statusCodes[position]?.name ?? 'BadUnexpectedError';
    });
    return results;
  }

  private async connectWithRetry(listener: IOpcUaDriverListener, attempt: number): Promise<void> {
    if (this.stopped) {
      return;
    }
    try {
      await this.open(listener);
    } catch (error) {
      if (this.stopped) {
        return;
      }
      const delayMs = Math.min(1000 * 2 ** attempt, SESSION_RETRY_MAX_DELAY_MS);
      this.logger.warn(
        `No se pudo abrir la sesión OPC UA con ${this.config.endpointUrl}: ` +
          `${(error as Error).message}. Reintento en ${delayMs} ms.`,
      );
      await this.closeQuietly();
      this.retryTimer = setTimeout(
        () => void this.connectWithRetry(listener, attempt + 1),
        delayMs,
      );
    }
  }

  private async open(listener: IOpcUaDriverListener): Promise<void> {
    this.monitoredItems.clear();
    const client = OPCUAClient.create({
      applicationName: 'EWControl',
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      // Se usa siempre el host configurado, no el que anuncia el servidor en
      // GetEndpoints (típico tras NAT/VPN o un PLC que anuncia su hostname).
      endpointMustExist: false,
      connectionStrategy: RECONNECTION_STRATEGY,
      keepSessionAlive: true,
      requestedSessionTimeout: 60000,
    });
    this.client = client;
    client.on('backoff', (count: number, delay: number) =>
      this.logger.debug(`Reintento ${count} de conexión OPC UA en ${delay} ms`),
    );
    client.on('connection_lost', () => {
      if (this.stopped || client !== this.client) {
        return;
      }
      listener.onDisconnected();
      const decision = this.policy.recordDisconnection();
      if (decision.pause) {
        void this.pause(listener, decision.delayMs);
      }
    });
    client.on('connection_reestablished', () => {
      if (!this.stopped && client === this.client) {
        this.policy.recordConnected();
        listener.onConnected();
        void this.reportServerTime(listener);
      }
    });

    await client.connect(this.config.endpointUrl);
    const session = await client.createSession();
    this.session = session;
    const subscription = ClientSubscription.create(session, {
      requestedPublishingInterval: this.config.samplingIntervalMs,
      requestedLifetimeCount: 120,
      requestedMaxKeepAliveCount: 10,
      maxNotificationsPerPublish: 1000,
      publishingEnabled: true,
      priority: 10,
    });
    this.subscription = subscription;
    await this.monitorInBatches(subscription, this.monitoredNodeIds, listener);
    if (this.stopped) {
      return;
    }
    this.policy.recordConnected();
    listener.onConnected();
    await this.reportServerTime(listener);
  }

  /**
   * spec 24, criterio 3: un `CreateMonitoredItems` por lote de como mucho
   * `MONITORED_ITEMS_BATCH_SIZE` NodeIds, uno detrás de otro. Un NodeId mal
   * formado o rechazado por el servidor se notifica sin afectar al resto.
   */
  private async monitorInBatches(
    subscription: ClientSubscription,
    nodeIds: readonly string[],
    listener: IOpcUaDriverListener,
  ): Promise<void> {
    const valid: { nodeId: string; resolved: NodeId }[] = [];
    for (const nodeId of nodeIds) {
      try {
        valid.push({ nodeId, resolved: resolveNodeId(nodeId) });
      } catch {
        listener.onMonitoredItemRejected(nodeId, 'BadNodeIdInvalid');
      }
    }
    for (let start = 0; start < valid.length; start += MONITORED_ITEMS_BATCH_SIZE) {
      if (this.stopped || subscription !== this.subscription) {
        return;
      }
      await this.monitorBatch(
        subscription,
        valid.slice(start, start + MONITORED_ITEMS_BATCH_SIZE),
        listener,
      );
    }
  }

  private monitorBatch(
    subscription: ClientSubscription,
    batch: { nodeId: string; resolved: NodeId }[],
    listener: IOpcUaDriverListener,
  ): Promise<void> {
    const group = ClientMonitoredItemGroup.create(
      subscription,
      batch.map(({ resolved }) => ({ nodeId: resolved, attributeId: AttributeIds.Value })),
      { samplingInterval: this.config.samplingIntervalMs, discardOldest: true, queueSize: 1 },
      TimestampsToReturn.Both,
    );
    group.monitoredItems.forEach((item, index) => {
      const { nodeId } = batch[index];
      this.monitoredItems.set(nodeId, item);
      item.on('err', (message: string) => {
        this.monitoredItems.delete(nodeId);
        if (!this.stopped) {
          listener.onMonitoredItemRejected(nodeId, message);
        }
      });
    });
    group.on('changed', (item: ClientMonitoredItemBase, dataValue: DataValue, index: number) => {
      if (!this.stopped) {
        listener.onDataChange(toDataChange(batch[index].nodeId, dataValue));
      }
    });
    return withTimeout(
      new Promise<void>((resolve) => {
        group.once('initialized', () => resolve());
        group.once('terminated', () => resolve());
      }),
      this.config.timeoutMs,
    ).catch(() => {
      this.logger.warn(
        `El servidor OPC UA ${this.config.endpointUrl} no confirmó ${batch.length} MonitoredItems ` +
          `en ${this.config.timeoutMs} ms.`,
      );
    });
  }

  /**
   * spec 24, criterio 4: demasiados cortes seguidos. Se cierra todo de forma
   * explícita y se vuelve a conectar desde cero tras la pausa.
   */
  private async pause(listener: IOpcUaDriverListener, delayMs: number): Promise<void> {
    this.logger.warn(
      `Conexión OPC UA inestable con ${this.config.endpointUrl}: se cierra la sesión y se ` +
        `reintenta en ${Math.round(delayMs / 1000)} s.`,
    );
    clearTimeout(this.retryTimer);
    await this.closeQuietly();
    if (this.stopped) {
      return;
    }
    this.retryTimer = setTimeout(() => void this.connectWithRetry(listener, 0), delayMs);
  }

  private async reportServerTime(listener: IOpcUaDriverListener): Promise<void> {
    try {
      const dataValue = await this.session?.read({
        nodeId: SERVER_CURRENT_TIME_NODE_ID,
        attributeId: AttributeIds.Value,
      });
      const serverTime: unknown = dataValue?.value?.value;
      if (serverTime instanceof Date && !this.stopped) {
        listener.onServerTime(serverTime);
      }
    } catch {
      // Solo diagnóstico: no poder leer la hora del servidor no afecta a la lectura.
    }
  }

  /**
   * spec 24, criterio 5: borra la Subscription y cierra la sesión en el
   * servidor antes de desconectar, cada paso con tiempo máximo; los fallos se
   * ignoran. Como mucho 5 s en total.
   */
  private async closeQuietly(): Promise<void> {
    const { subscription, session, client } = this;
    this.subscription = undefined;
    this.session = undefined;
    this.client = undefined;
    this.monitoredItems.clear();
    if (subscription) {
      await withTimeout(subscription.terminate(), CLOSE_STEP_TIMEOUT_MS).catch(() => undefined);
    }
    if (session) {
      await withTimeout(session.close(true), CLOSE_STEP_TIMEOUT_MS).catch(() => undefined);
    }
    if (client) {
      await withTimeout(client.disconnect(), DISCONNECT_TIMEOUT_MS).catch(() => undefined);
    }
  }
}

export const createNodeOpcUaDriver: OpcUaDriverFactory = (config) => new NodeOpcUaDriver(config);

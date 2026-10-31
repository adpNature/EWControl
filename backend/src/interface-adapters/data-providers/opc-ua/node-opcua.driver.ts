import { Logger } from '@nestjs/common';
import {
  AttributeIds,
  type ClientSession,
  ClientMonitoredItem,
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

/** spec 18: reintento indefinido con backoff exponencial, máximo 30 s entre intentos. */
const RECONNECTION_STRATEGY = { maxRetry: -1, initialDelay: 1000, maxDelay: 30000 };
const SESSION_RETRY_MAX_DELAY_MS = 30000;
/** `Server_ServerStatus_CurrentTime` (OPC UA Part 5): solo para detectar desfases de reloj. */
const SERVER_CURRENT_TIME_NODE_ID = 'ns=0;i=2258';

/**
 * Implementación de `IOpcUaDriver` sobre `node-opcua-client` (spec 18). Una
 * sesión anónima sin cifrado con una única Subscription y un MonitoredItem por
 * `nodeMapping`. La reconexión tras perder el canal (y la reparación de sesión
 * y Subscription) la hace node-opcua; este driver solo reintenta si falla la
 * creación inicial de la sesión.
 */
export class NodeOpcUaDriver implements IOpcUaDriver {
  private readonly logger = new Logger(NodeOpcUaDriver.name);
  private client: OPCUAClient | undefined;
  private session: ClientSession | undefined;
  private subscription: ClientSubscription | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private stopped = true;

  constructor(private readonly config: OpcUaConnectionConfig) {}

  start(listener: IOpcUaDriverListener): void {
    this.stopped = false;
    void this.connectWithRetry(listener, 0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    await this.closeQuietly();
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
      if (!this.stopped) {
        listener.onDisconnected();
      }
    });
    client.on('connection_reestablished', () => {
      if (!this.stopped) {
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
    for (const { nodeId } of this.config.nodeMapping) {
      this.monitor(subscription, nodeId, listener);
    }
    if (this.stopped) {
      return;
    }
    listener.onConnected();
    await this.reportServerTime(listener);
  }

  private monitor(
    subscription: ClientSubscription,
    nodeId: string,
    listener: IOpcUaDriverListener,
  ): void {
    let resolvedNodeId;
    try {
      resolvedNodeId = resolveNodeId(nodeId);
    } catch {
      listener.onMonitoredItemRejected(nodeId, 'BadNodeIdInvalid');
      return;
    }
    const item = ClientMonitoredItem.create(
      subscription,
      { nodeId: resolvedNodeId, attributeId: AttributeIds.Value },
      { samplingInterval: this.config.samplingIntervalMs, discardOldest: true, queueSize: 1 },
      TimestampsToReturn.Both,
    );
    item.on('changed', (dataValue: DataValue) => {
      if (!this.stopped) {
        listener.onDataChange(toDataChange(nodeId, dataValue));
      }
    });
    item.on('err', (message: string) => {
      if (!this.stopped) {
        listener.onMonitoredItemRejected(nodeId, message);
      }
    });
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

  private async closeQuietly(): Promise<void> {
    const { subscription, session, client } = this;
    this.subscription = undefined;
    this.session = undefined;
    this.client = undefined;
    await subscription?.terminate().catch(() => undefined);
    await session?.close().catch(() => undefined);
    await client?.disconnect().catch(() => undefined);
  }
}

export const createNodeOpcUaDriver: OpcUaDriverFactory = (config) => new NodeOpcUaDriver(config);

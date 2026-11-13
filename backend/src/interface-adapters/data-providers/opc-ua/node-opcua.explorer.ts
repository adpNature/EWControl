import { Injectable, Logger } from '@nestjs/common';
import {
  AttributeIds,
  BrowseDirection,
  type BrowseResult,
  type ClientSession,
  MessageSecurityMode,
  type NodeId,
  NodeClass,
  OPCUAClient,
  type QualifiedName,
  type ReadValueIdOptions,
  type ReferenceDescription,
  resolveNodeId,
  SecurityPolicy,
  StatusCodes,
} from 'node-opcua-client';
import { OpcUaEndpointUnreachableError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-unreachable.error';
import { OpcUaInvalidNodeIdError } from '../../../use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import { OpcUaSyncTimeoutError } from '../../../use-cases/machine-management/errors/opc-ua-sync-timeout.error';
import { OpcUaSyncTooManyNodesError } from '../../../use-cases/machine-management/errors/opc-ua-sync-too-many-nodes.error';
import {
  classifyOpcUaVariable,
  type LiveOpcUaVariable,
  type SkippedOpcUaVariable,
} from '../../../entities/opc-ua-variable-sync';
import type {
  IOpcUaExplorer,
  OpcUaBrowseNode,
  OpcUaConnectionTestResult,
  OpcUaFolderScan,
  OpcUaScanLimits,
} from '../../../use-cases/machine-management/ports/opc-ua-explorer.port';
import {
  classifyConnectionError,
  OpcUaTimeoutError,
  standardDataTypeName,
  variableMayHaveChildren,
  withTimeout,
} from './node-opcua.mappers';

const OBJECTS_FOLDER = 'ObjectsFolder';
const INVALID_NODE_STATUS_CODES = new Set([
  StatusCodes.BadNodeIdUnknown.value,
  StatusCodes.BadNodeIdInvalid.value,
]);

/** Peticiones por mensaje `Browse`/`Read`: holgadas frente a los límites habituales de los servidores. */
const BROWSE_BATCH_SIZE = 200;
/** spec 24, criterio 6: si una sesión del explorador queda huérfana, el PLC la libera antes. */
export const EXPLORER_SESSION_TIMEOUT_MS = 30000;
const CLOSE_SESSION_TIMEOUT_MS = 2000;
const READ_BATCH_SIZE = 500;
/** Bit `CurrentWrite` del `AccessLevel` (OPC UA Part 3, 8.57). */
const ACCESS_LEVEL_CURRENT_WRITE = 0x02;
const HAS_PROPERTY = resolveNodeId('HasProperty').toString();
const SCANNED_ATTRIBUTES = [
  AttributeIds.DataType,
  AttributeIds.ValueRank,
  AttributeIds.ArrayDimensions,
  AttributeIds.AccessLevel,
];

/** Variable encontrada al recorrer una carpeta, antes de leer sus atributos. */
type ScannedNode = { nodeId: NodeId; path: string[] };

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function hierarchicalBrowse(nodeId: NodeId) {
  return {
    nodeId,
    browseDirection: BrowseDirection.Forward,
    referenceTypeId: 'HierarchicalReferences',
    includeSubtypes: true,
    nodeClassMask: 0,
    resultMask: 63,
  };
}

/**
 * Implementación de `IOpcUaExplorer` sobre `node-opcua-client` (spec 18,
 * criterios backend 5 y 6): cada llamada abre una sesión anónima efímera, de
 * solo lectura (GetEndpoints/Browse/Read), y la cierra siempre. El detalle
 * técnico de los errores solo va al log (OWASP A05).
 */
@Injectable()
export class NodeOpcUaExplorer implements IOpcUaExplorer {
  private readonly logger = new Logger(NodeOpcUaExplorer.name);
  /** spec 24, criterio 7: última operación encolada por endpoint. */
  private readonly queues = new Map<string, Promise<void>>();

  async testConnection(endpointUrl: string, timeoutMs: number): Promise<OpcUaConnectionTestResult> {
    try {
      await this.withSession(endpointUrl, timeoutMs, async () => undefined);
      return { reachable: true };
    } catch (error) {
      this.logger.warn(
        `Prueba de conexión OPC UA fallida contra ${endpointUrl}: ${(error as Error).message}`,
      );
      return { reachable: false, reason: classifyConnectionError(error) };
    }
  }

  async browse(
    endpointUrl: string,
    nodeId: string | undefined,
    timeoutMs: number,
  ): Promise<OpcUaBrowseNode[]> {
    let target: NodeId;
    try {
      target = resolveNodeId(nodeId ?? OBJECTS_FOLDER);
    } catch {
      throw new OpcUaInvalidNodeIdError(nodeId ?? '');
    }
    try {
      return await this.withSession(endpointUrl, timeoutMs, (session) =>
        this.browseChildren(session, target, nodeId ?? OBJECTS_FOLDER),
      );
    } catch (error) {
      if (error instanceof OpcUaInvalidNodeIdError) {
        throw error;
      }
      this.logger.warn(
        `Exploración OPC UA fallida contra ${endpointUrl}: ${(error as Error).message}`,
      );
      throw new OpcUaEndpointUnreachableError();
    }
  }

  async scanVariables(
    endpointUrl: string,
    rootNodeId: string,
    savedNodeIds: readonly string[],
    limits: OpcUaScanLimits,
  ): Promise<OpcUaFolderScan> {
    let root: NodeId;
    try {
      root = resolveNodeId(rootNodeId);
    } catch {
      throw new OpcUaInvalidNodeIdError(rootNodeId);
    }
    try {
      return await this.withSession(endpointUrl, limits.timeoutMs, (session) =>
        this.scanFolder(session, root, rootNodeId, savedNodeIds, limits),
      );
    } catch (error) {
      if (error instanceof OpcUaInvalidNodeIdError || error instanceof OpcUaSyncTooManyNodesError) {
        throw error;
      }
      if (error instanceof OpcUaTimeoutError) {
        throw new OpcUaSyncTimeoutError(limits.timeoutMs);
      }
      this.logger.warn(
        `Sincronización OPC UA fallida contra ${endpointUrl}: ${(error as Error).message}`,
      );
      throw new OpcUaEndpointUnreachableError();
    }
  }

  /**
   * spec 21, criterios backend 2 y 3: recorrido por niveles (un `Browse` por
   * lote de nodos del nivel), sin seguir `HasProperty`, entrando también en
   * Variables (los elementos de un array cuelgan de él).
   */
  private async scanFolder(
    session: ClientSession,
    root: NodeId,
    rootNodeId: string,
    savedNodeIds: readonly string[],
    limits: OpcUaScanLimits,
  ): Promise<OpcUaFolderScan> {
    const [rootName] = await session.read([{ nodeId: root, attributeId: AttributeIds.BrowseName }]);
    if (INVALID_NODE_STATUS_CODES.has(rootName.statusCode.value)) {
      throw new OpcUaInvalidNodeIdError(rootNodeId);
    }
    const rootBrowseName = (rootName.value.value as QualifiedName | null)?.name ?? rootNodeId;

    const seen = new Set<string>([root.toString()]);
    const found: ScannedNode[] = [];
    let level: ScannedNode[] = [{ nodeId: root, path: [rootBrowseName] }];
    for (let depth = 0; depth < limits.maxDepth && level.length > 0; depth += 1) {
      const children = await this.browseMany(
        session,
        level.map((node) => node.nodeId),
      );
      const next: ScannedNode[] = [];
      level.forEach((parent, index) => {
        for (const reference of children[index]) {
          const childId = reference.nodeId.toString();
          if (reference.referenceTypeId.toString() === HAS_PROPERTY || seen.has(childId)) {
            continue;
          }
          seen.add(childId);
          const child = {
            nodeId: reference.nodeId as NodeId,
            path: [...parent.path, reference.browseName.name ?? childId],
          };
          if (reference.nodeClass === NodeClass.Variable) {
            found.push(child);
            if (found.length > limits.maxVariables) {
              throw new OpcUaSyncTooManyNodesError(limits.maxVariables);
            }
          }
          if (
            reference.nodeClass === NodeClass.Variable ||
            reference.nodeClass === NodeClass.Object
          ) {
            next.push(child);
          }
        }
      });
      level = next;
    }

    const { variables, skipped } = await this.describeVariables(session, found);
    const foundIds = new Set(found.map((node) => node.nodeId.toString()));
    const existence = await this.checkExistence(
      session,
      savedNodeIds.filter((nodeId) => !foundIds.has(nodeId)),
    );
    return { variables, skipped, existence };
  }

  /** `Browse` por lotes con sus `BrowseNext`; devuelve las referencias de cada nodo en el mismo orden. */
  private async browseMany(
    session: ClientSession,
    nodeIds: readonly NodeId[],
  ): Promise<ReferenceDescription[][]> {
    const all: ReferenceDescription[][] = [];
    for (const batch of chunk(nodeIds, BROWSE_BATCH_SIZE)) {
      const results = (await session.browse(batch.map(hierarchicalBrowse))) as BrowseResult[];
      for (const result of results) {
        const references = [...(result.references ?? [])];
        let current = result;
        while (current.continuationPoint && current.continuationPoint.length > 0) {
          current = await session.browseNext(current.continuationPoint, false);
          references.push(...(current.references ?? []));
        }
        all.push(references);
      }
    }
    return all;
  }

  /** Lee `DataType`, `ValueRank`, `ArrayDimensions` y `AccessLevel` por lotes y separa mapeables de omitidas. */
  private async describeVariables(
    session: ClientSession,
    nodes: readonly ScannedNode[],
  ): Promise<{ variables: LiveOpcUaVariable[]; skipped: SkippedOpcUaVariable[] }> {
    const width = SCANNED_ATTRIBUTES.length;
    const values = await this.readMany(
      session,
      nodes.flatMap((node) =>
        SCANNED_ATTRIBUTES.map((attributeId) => ({ nodeId: node.nodeId, attributeId })),
      ),
    );
    const dataTypeIds = nodes.map(
      (_, index) => (values[index * width]?.value?.value ?? undefined) as NodeId | undefined,
    );
    const dataTypeNames = await this.resolveDataTypeNames(
      session,
      dataTypeIds.filter((id): id is NodeId => id !== undefined),
    );

    const variables: LiveOpcUaVariable[] = [];
    const skipped: SkippedOpcUaVariable[] = [];
    nodes.forEach((node, index) => {
      const base = index * width;
      const dataTypeId = dataTypeIds[index];
      const dataType = dataTypeId ? (dataTypeNames.get(dataTypeId.toString()) ?? '') : '';
      const valueRank = Number(values[base + 1]?.value?.value ?? -1);
      const dimensions = values[base + 2]?.value?.value as ArrayLike<number> | null | undefined;
      const accessLevel = Number(values[base + 3]?.value?.value ?? 0);
      const nodeId = node.nodeId.toString();
      const reason = classifyOpcUaVariable(dataType, valueRank);
      if (reason === null) {
        variables.push({
          nodeId,
          path: node.path,
          dataType,
          plcWritable: (accessLevel & ACCESS_LEVEL_CURRENT_WRITE) !== 0,
        });
      } else {
        skipped.push({
          nodeId,
          path: node.path,
          dataType,
          valueRank,
          arrayDimensions: dimensions ? Array.from(dimensions) : null,
          reason,
        });
      }
    });
    return { variables, skipped };
  }

  /** `true` si el servidor conoce el nodo; `false` si responde `BadNodeIdUnknown`/`BadNodeIdInvalid`. */
  private async checkExistence(
    session: ClientSession,
    nodeIds: readonly string[],
  ): Promise<Map<string, boolean>> {
    const existence = new Map<string, boolean>();
    const resolvable: { raw: string; nodeId: NodeId }[] = [];
    for (const raw of nodeIds) {
      try {
        resolvable.push({ raw, nodeId: resolveNodeId(raw) });
      } catch {
        existence.set(raw, false);
      }
    }
    const values = await this.readMany(
      session,
      resolvable.map(({ nodeId }) => ({ nodeId, attributeId: AttributeIds.NodeClass })),
    );
    resolvable.forEach(({ raw }, index) => {
      existence.set(raw, !INVALID_NODE_STATUS_CODES.has(values[index].statusCode.value));
    });
    return existence;
  }

  private async readMany(session: ClientSession, requests: readonly ReadValueIdOptions[]) {
    const results = [];
    for (const batch of chunk(requests, READ_BATCH_SIZE)) {
      results.push(...(await session.read(batch)));
    }
    return results;
  }

  /** Nombre de cada `DataType`: estándar por tabla, propio del servidor por su `BrowseName`. */
  private async resolveDataTypeNames(
    session: ClientSession,
    dataTypeIds: readonly NodeId[],
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const custom = new Map<string, NodeId>();
    for (const dataTypeId of dataTypeIds) {
      const standard = standardDataTypeName(dataTypeId);
      if (standard) {
        names.set(dataTypeId.toString(), standard);
      } else {
        custom.set(dataTypeId.toString(), dataTypeId);
      }
    }
    const ids = [...custom.values()];
    const browseNames = await this.readMany(
      session,
      ids.map((nodeId) => ({ nodeId, attributeId: AttributeIds.BrowseName })),
    );
    ids.forEach((nodeId, index) => {
      const qualifiedName = browseNames[index]?.value?.value as QualifiedName | undefined;
      names.set(nodeId.toString(), qualifiedName?.name ?? nodeId.toString());
    });
    return names;
  }

  private async browseChildren(
    session: ClientSession,
    target: NodeId,
    requestedNodeId: string,
  ): Promise<OpcUaBrowseNode[]> {
    const references = await this.browseAll(session, target, requestedNodeId);
    if (references.length === 0) {
      return [];
    }
    const variables = references.filter((reference) => reference.nodeClass === NodeClass.Variable);
    const others = references.filter((reference) => reference.nodeClass !== NodeClass.Variable);
    const described = await this.describeBrowsedVariables(session, variables);
    const othersWithChildren = await this.nodesWithChildren(session, others);

    return references.map((reference) => {
      const nodeId = reference.nodeId.toString();
      const browseName = reference.browseName.name ?? reference.browseName.toString();
      const variable = described.get(nodeId);
      const node: OpcUaBrowseNode = {
        nodeId,
        browseName,
        displayName: reference.displayName.text ?? browseName,
        nodeClass: NodeClass[reference.nodeClass],
        hasChildren: variable ? variable.hasChildren : othersWithChildren.has(nodeId),
      };
      if (variable?.dataType) {
        node.dataType = variable.dataType;
      }
      return node;
    });
  }

  /**
   * spec 18, criterio backend 6: `hasChildren` de los nodos que no son
   * `Variable` (carpetas, Objects) con un `Browse` real, por lotes. Basta la
   * primera página: no se siguen los `BrowseNext`.
   */
  private async nodesWithChildren(
    session: ClientSession,
    references: readonly ReferenceDescription[],
  ): Promise<Set<string>> {
    const withChildren = new Set<string>();
    for (const batch of chunk(references, BROWSE_BATCH_SIZE)) {
      const results = (await session.browse(
        batch.map((reference) => hierarchicalBrowse(reference.nodeId as NodeId)),
      )) as BrowseResult[];
      batch.forEach((reference, index) => {
        if ((results[index]?.references?.length ?? 0) > 0) {
          withChildren.add(reference.nodeId.toString());
        }
      });
    }
    return withChildren;
  }

  private async browseAll(
    session: ClientSession,
    target: NodeId,
    requestedNodeId: string,
  ): Promise<ReferenceDescription[]> {
    let result = await session.browse(hierarchicalBrowse(target));
    if (INVALID_NODE_STATUS_CODES.has(result.statusCode.value)) {
      throw new OpcUaInvalidNodeIdError(requestedNodeId);
    }
    const references = [...(result.references ?? [])];
    while (result.continuationPoint && result.continuationPoint.length > 0) {
      result = await session.browseNext(result.continuationPoint, false);
      references.push(...(result.references ?? []));
    }
    return references;
  }

  /**
   * Nombre del `DataType` de cada hijo `Variable` y si puede tener hijos
   * (deducido de `DataType` + `ValueRank`, sin `Browse`), indexado por su NodeId.
   */
  private async describeBrowsedVariables(
    session: ClientSession,
    variables: readonly ReferenceDescription[],
  ): Promise<Map<string, { dataType: string; hasChildren: boolean }>> {
    const described = new Map<string, { dataType: string; hasChildren: boolean }>();
    if (variables.length === 0) {
      return described;
    }
    const values = await this.readMany(
      session,
      variables.flatMap((reference) => [
        { nodeId: reference.nodeId as NodeId, attributeId: AttributeIds.DataType },
        { nodeId: reference.nodeId as NodeId, attributeId: AttributeIds.ValueRank },
      ]),
    );
    const dataTypeIds = variables.map(
      (_, index) => (values[index * 2]?.value?.value ?? undefined) as NodeId | undefined,
    );
    const typeNames = await this.resolveDataTypeNames(
      session,
      dataTypeIds.filter((id): id is NodeId => id !== undefined),
    );
    variables.forEach((reference, index) => {
      const dataTypeId = dataTypeIds[index];
      const valueRank = Number(values[index * 2 + 1]?.value?.value ?? -1);
      described.set(reference.nodeId.toString(), {
        dataType: dataTypeId ? (typeNames.get(dataTypeId.toString()) ?? '') : '',
        hasChildren: variableMayHaveChildren(dataTypeId, valueRank),
      });
    });
    return described;
  }

  /**
   * Sesión de corta duración para una operación del explorador o de la
   * sincronización (docs/specs/24-conexion-opc-ua-estable.md, criterios 6 y 7):
   * - una sola operación a la vez por endpoint (el tiempo límite cuenta desde
   *   que se encola);
   * - la sesión se cierra siempre en el servidor antes de desconectar, también
   *   si vence el tiempo límite, para no dejar sesiones huérfanas en el PLC.
   */
  private withSession<T>(
    endpointUrl: string,
    timeoutMs: number,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    const queued = this.serialized(endpointUrl, () => {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return Promise.reject(new OpcUaTimeoutError(timeoutMs));
      }
      return this.runSession(endpointUrl, remainingMs, work);
    });
    return withTimeout(queued, timeoutMs);
  }

  private async runSession<T>(
    endpointUrl: string,
    timeoutMs: number,
    work: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const client = OPCUAClient.create({
      applicationName: 'EWControl-Explorer',
      securityMode: MessageSecurityMode.None,
      securityPolicy: SecurityPolicy.None,
      endpointMustExist: false,
      connectionStrategy: { maxRetry: 0, initialDelay: 100, maxDelay: 200 },
      requestedSessionTimeout: EXPLORER_SESSION_TIMEOUT_MS,
    });
    let session: ClientSession | undefined;
    let finished = false;
    const run = (async () => {
      await client.connect(endpointUrl);
      const created = await client.createSession();
      if (finished) {
        // Llegó después del tiempo límite: se cierra en vez de dejarla huérfana.
        await withTimeout(created.close(), CLOSE_SESSION_TIMEOUT_MS).catch(() => undefined);
        throw new OpcUaTimeoutError(timeoutMs);
      }
      session = created;
      return work(created);
    })();
    try {
      return await withTimeout(run, timeoutMs);
    } finally {
      finished = true;
      if (session) {
        await withTimeout(session.close(), CLOSE_SESSION_TIMEOUT_MS).catch(() => undefined);
      }
      await withTimeout(client.disconnect(), CLOSE_SESSION_TIMEOUT_MS).catch(() => undefined);
    }
  }

  /** Encadena las tareas de un mismo endpoint: cada una empieza cuando acaba la anterior. */
  private serialized<T>(endpointUrl: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(endpointUrl) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(endpointUrl, tail);
    void tail.then(() => {
      if (this.queues.get(endpointUrl) === tail) {
        this.queues.delete(endpointUrl);
      }
    });
    return result;
  }
}

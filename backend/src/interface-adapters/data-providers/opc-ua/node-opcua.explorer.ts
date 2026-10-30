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
  type ReferenceDescription,
  resolveNodeId,
  SecurityPolicy,
  StatusCodes,
} from 'node-opcua-client';
import { OpcUaEndpointUnreachableError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-unreachable.error';
import { OpcUaInvalidNodeIdError } from '../../../use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import type {
  IOpcUaExplorer,
  OpcUaBrowseNode,
  OpcUaConnectionTestResult,
} from '../../../use-cases/machine-management/ports/opc-ua-explorer.port';
import { classifyConnectionError, standardDataTypeName, withTimeout } from './node-opcua.mappers';

const OBJECTS_FOLDER = 'ObjectsFolder';
const INVALID_NODE_STATUS_CODES = new Set([
  StatusCodes.BadNodeIdUnknown.value,
  StatusCodes.BadNodeIdInvalid.value,
]);

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

  private async browseChildren(
    session: ClientSession,
    target: NodeId,
    requestedNodeId: string,
  ): Promise<OpcUaBrowseNode[]> {
    const references = await this.browseAll(session, target, requestedNodeId);
    if (references.length === 0) {
      return [];
    }
    // Una sola petición para saber qué hijos tienen a su vez hijos.
    const grandChildren = (await session.browse(
      references.map((reference) => hierarchicalBrowse(reference.nodeId as NodeId)),
    )) as BrowseResult[];
    const dataTypes = await this.readDataTypeNames(session, references);

    return references.map((reference, index) => {
      const nodeId = reference.nodeId.toString();
      const browseName = reference.browseName.name ?? reference.browseName.toString();
      const node: OpcUaBrowseNode = {
        nodeId,
        browseName,
        displayName: reference.displayName.text ?? browseName,
        nodeClass: NodeClass[reference.nodeClass],
        hasChildren: (grandChildren[index]?.references?.length ?? 0) > 0,
      };
      const dataType = dataTypes.get(nodeId);
      if (dataType) {
        node.dataType = dataType;
      }
      return node;
    });
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

  /** Nombre del `DataType` de cada hijo `Variable`: estándar por tabla, propio del servidor por su `BrowseName`. */
  private async readDataTypeNames(
    session: ClientSession,
    references: ReferenceDescription[],
  ): Promise<Map<string, string>> {
    const variables = references.filter((reference) => reference.nodeClass === NodeClass.Variable);
    const names = new Map<string, string>();
    if (variables.length === 0) {
      return names;
    }
    const dataTypeValues = await session.read(
      variables.map((reference) => ({
        nodeId: reference.nodeId as NodeId,
        attributeId: AttributeIds.DataType,
      })),
    );
    const customTypeIds = new Map<string, NodeId>();
    const dataTypeIdByVariable = new Map<string, NodeId>();
    variables.forEach((reference, index) => {
      const dataTypeId = dataTypeValues[index]?.value?.value as NodeId | undefined;
      if (!dataTypeId) {
        return;
      }
      dataTypeIdByVariable.set(reference.nodeId.toString(), dataTypeId);
      if (!standardDataTypeName(dataTypeId)) {
        customTypeIds.set(dataTypeId.toString(), dataTypeId);
      }
    });

    const customNames = new Map<string, string>();
    if (customTypeIds.size > 0) {
      const ids = [...customTypeIds.values()];
      const browseNames = await session.read(
        ids.map((nodeId) => ({ nodeId, attributeId: AttributeIds.BrowseName })),
      );
      ids.forEach((nodeId, index) => {
        const qualifiedName = browseNames[index]?.value?.value as { name?: string } | undefined;
        customNames.set(nodeId.toString(), qualifiedName?.name ?? nodeId.toString());
      });
    }

    for (const [variableId, dataTypeId] of dataTypeIdByVariable) {
      names.set(
        variableId,
        standardDataTypeName(dataTypeId) ?? customNames.get(dataTypeId.toString()) ?? '',
      );
    }
    return names;
  }

  private async withSession<T>(
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
      requestedSessionTimeout: 60000,
    });
    const run = (async () => {
      await client.connect(endpointUrl);
      const session = await client.createSession();
      try {
        return await work(session);
      } finally {
        await session.close().catch(() => undefined);
      }
    })();
    try {
      return await withTimeout(run, timeoutMs);
    } finally {
      await client.disconnect().catch(() => undefined);
    }
  }
}

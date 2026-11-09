import type {
  LiveOpcUaVariable,
  SkippedOpcUaVariable,
} from '../../../entities/opc-ua-variable-sync';

export const OPCUA_EXPLORER = Symbol('OpcUaExplorer');

export type OpcUaConnectionTestFailureReason = 'UNREACHABLE' | 'TIMEOUT' | 'SECURITY_REJECTED';

export type OpcUaConnectionTestResult =
  { reachable: true } | { reachable: false; reason: OpcUaConnectionTestFailureReason };

/** Hijo directo de un nodo del espacio de direcciones (spec 18, criterio backend 6). */
export type OpcUaBrowseNode = {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  /** Solo en nodos `Variable`: nombre del tipo (`Double`, `Boolean`...) o el NodeId del tipo si no es estándar. */
  dataType?: string;
  hasChildren: boolean;
};

/** Límites de un recorrido de carpeta (spec 21, OWASP A04). */
export type OpcUaScanLimits = { timeoutMs: number; maxVariables: number; maxDepth: number };

/** Resultado de recorrer una carpeta (spec 21). */
export type OpcUaFolderScan = {
  variables: LiveOpcUaVariable[];
  skipped: SkippedOpcUaVariable[];
  /**
   * Para cada `nodeId` de `savedNodeIds` que no ha aparecido bajo la carpeta:
   * `true` si el servidor lo conoce, `false` si responde `BadNodeIdUnknown`.
   */
  existence: Map<string, boolean>;
};

/**
 * Sesiones OPC UA efímeras, anónimas y de solo lectura para configurar una
 * conexión (spec 18): nunca mantiene una sesión abierta entre llamadas.
 */
export interface IOpcUaExplorer {
  testConnection(endpointUrl: string, timeoutMs: number): Promise<OpcUaConnectionTestResult>;
  /**
   * @throws OpcUaEndpointUnreachableError si no hay conexión o vence el timeout.
   * @throws OpcUaInvalidNodeIdError si `nodeId` no es sintácticamente válido.
   */
  browse(
    endpointUrl: string,
    nodeId: string | undefined,
    timeoutMs: number,
  ): Promise<OpcUaBrowseNode[]>;
  /**
   * Recorre por niveles todo lo que cuelga de `rootNodeId`, en una sola sesión
   * (spec 21, criterios backend 2 y 3), y comprueba si siguen existiendo los
   * `savedNodeIds` que no aparecen bajo la carpeta.
   * @throws OpcUaEndpointUnreachableError si no hay conexión.
   * @throws OpcUaInvalidNodeIdError si `rootNodeId` no es válido o no existe.
   * @throws OpcUaSyncTimeoutError si se supera `limits.timeoutMs`.
   * @throws OpcUaSyncTooManyNodesError si hay más de `limits.maxVariables` variables.
   */
  scanVariables(
    endpointUrl: string,
    rootNodeId: string,
    savedNodeIds: readonly string[],
    limits: OpcUaScanLimits,
  ): Promise<OpcUaFolderScan>;
}

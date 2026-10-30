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
}

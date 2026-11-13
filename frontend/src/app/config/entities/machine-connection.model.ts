/**
 * Documento 3, apartado 3.2.4/3.4. Formas de `Simulator` y `OpcUa`
 * (docs/specs/18-integracion-opc-ua.md). Interfaces TS puras, sin imports de Angular.
 */
export type ProviderType = 'Simulator' | 'OpcUa';

export type SimulatorSignalSeed =
  | { variableName: string; min: number; max: number; stepMax: number }
  | { variableName: string; mode: 'incremental' }
  | { variableName: string; mode: 'cycle'; cycleTicks: number };

export interface SimulatorConnectionConfig {
  seedProfile: string;
  signals: SimulatorSignalSeed[];
}

export interface OpcUaNodeMapping {
  nodeId: string;
  signalVariableName: string;
  /** docs/specs/21-sincronizacion-variables-opc-ua.md: nombre legible, no interviene en lecturas ni fórmulas. */
  label?: string;
  /** docs/specs/20-paquetes-escritura-opc-ua.md: escribible por paquetes, con su tipo y límites. */
  writable?: boolean;
  dataType?: string;
  min?: number;
  max?: number;
}

/** spec 18: solo `None`/`None`/`Anonymous`. */
export interface OpcUaConnectionConfig {
  endpointUrl: string;
  securityMode: 'None';
  securityPolicy: 'None';
  authMode: 'Anonymous';
  timeoutMs: number;
  samplingIntervalMs: number;
  nodeMapping: OpcUaNodeMapping[];
  /** spec 21: última carpeta sincronizada y guardada. */
  variableSyncRootNodeId?: string;
}

export type ConnectionConfig = SimulatorConnectionConfig | OpcUaConnectionConfig;

export interface MachineConnection {
  id: string;
  machineId: string;
  providerType: ProviderType;
  connectionConfig: ConnectionConfig;
}

export type ReplaceConnectionRequest =
  | { providerType: 'Simulator'; connectionConfig: SimulatorConnectionConfig }
  | { providerType: 'OpcUa'; connectionConfig: OpcUaConnectionConfig };

export type OpcUaConnectionTestResult =
  | { reachable: true }
  | { reachable: false; reason: 'UNREACHABLE' | 'TIMEOUT' | 'SECURITY_REJECTED' };

/** Hijo directo de un nodo del servidor OPC UA (spec 18, `POST .../opcua/browse`). */
export interface OpcUaBrowseNode {
  nodeId: string;
  browseName: string;
  displayName: string;
  nodeClass: string;
  dataType?: string;
  hasChildren: boolean;
}

export function isOpcUaConnectionConfig(config: ConnectionConfig): config is OpcUaConnectionConfig {
  return 'endpointUrl' in config;
}

/** Variables que expone la Machine: semillas del Simulador o `nodeMapping` de OPC UA. */
export function listKnownVariableNames(config: ConnectionConfig): string[] {
  return listKnownVariables(config).map((variable) => variable.name);
}

/** Variable conocida con su etiqueta, si la tiene (spec 21: sugerencias del formulario de Signal). */
export interface KnownVariable {
  name: string;
  label?: string;
  /** NodeId OPC UA, para buscar su categoría (docs/specs/23-categorias-variables-plc.md). */
  nodeId?: string;
}

export function listKnownVariables(config: ConnectionConfig): KnownVariable[] {
  return isOpcUaConnectionConfig(config)
    ? config.nodeMapping.map((entry) =>
        entry.label
          ? { name: entry.signalVariableName, label: entry.label, nodeId: entry.nodeId }
          : { name: entry.signalVariableName, nodeId: entry.nodeId },
      )
    : config.signals.map((signal) => ({ name: signal.variableName }));
}

/** Respuesta de `POST .../connection/opcua/variables/sync` (docs/specs/21-sincronizacion-variables-opc-ua.md). */
export type SyncedVariableStatus = 'new' | 'unchanged' | 'typeChanged';

export interface SavedOpcUaVariable {
  signalVariableName: string;
  label: string | null;
  dataType: string | null;
}

export interface SyncedOpcUaVariable {
  nodeId: string;
  path: string[];
  dataType: string;
  plcWritable: boolean;
  status: SyncedVariableStatus;
  saved: SavedOpcUaVariable | null;
}

export interface RemovedOpcUaVariable extends SavedOpcUaVariable {
  nodeId: string;
}

export interface SkippedOpcUaVariable {
  nodeId: string;
  path: string[];
  dataType: string;
  valueRank: number;
  arrayDimensions: number[] | null;
  reason: 'nonScalar' | 'unsupportedType';
}

export interface OpcUaVariableSyncSummary {
  total: number;
  new: number;
  unchanged: number;
  typeChanged: number;
  removed: number;
  skipped: number;
  byDataType: Record<string, number>;
}

export interface OpcUaVariableSyncResult {
  rootNodeId: string;
  syncedAt: string;
  summary: OpcUaVariableSyncSummary;
  variables: SyncedOpcUaVariable[];
  removed: RemovedOpcUaVariable[];
  skipped: SkippedOpcUaVariable[];
}

/** Body de `PUT .../connection/opcua/variables` (spec 21). */
export interface SaveOpcUaVariablesRequest {
  rootNodeId: string;
  variables: {
    nodeId: string;
    signalVariableName: string;
    label: string | null;
    dataType: string;
  }[];
  remove: string[];
}

/** `details` de un `409 OPCUA_VARIABLE_IN_USE` (spec 21). */
export interface OpcUaVariableInUse {
  signalVariableName: string;
  usedBy: { kind: 'Signal' | 'WritePackage'; id: string; name: string }[];
}

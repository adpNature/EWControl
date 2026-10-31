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
  return isOpcUaConnectionConfig(config)
    ? config.nodeMapping.map((entry) => entry.signalVariableName)
    : config.signals.map((signal) => signal.variableName);
}

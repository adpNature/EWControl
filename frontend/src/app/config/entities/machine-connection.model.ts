/**
 * Documento 3, apartado 3.2.4/3.4. Solo se modela la forma de Simulator — es
 * el único ProviderType soportado hasta la spec de integración OPC UA real
 * (docs/specs/06-gestion-machines-signals.md).
 */
export type ProviderType = 'Simulator';

export type SimulatorSignalSeed =
  | { variableName: string; min: number; max: number; stepMax: number }
  | { variableName: string; mode: 'incremental' }
  | { variableName: string; mode: 'cycle'; cycleTicks: number };

export interface ConnectionConfig {
  seedProfile: string;
  signals: SimulatorSignalSeed[];
}

export interface MachineConnection {
  id: string;
  machineId: string;
  providerType: ProviderType;
  connectionConfig: ConnectionConfig;
}

export interface ReplaceConnectionRequest {
  providerType: ProviderType;
  connectionConfig: ConnectionConfig;
}

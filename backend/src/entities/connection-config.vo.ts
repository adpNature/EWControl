/**
 * Configuración de conexión de una MachineConnection (Documento 3, apartado 3.4).
 * Solo se modela la forma de ProviderType.Simulator (Documento 10, apartado 10.3);
 * las formas de OpcUa/Mqtt/ModbusTcp se añaden cuando sus specs lo requieran.
 */
export type SimulatorSignalSeed =
  | { variableName: string; min: number; max: number; stepMax: number }
  | { variableName: string; mode: 'incremental' }
  | { variableName: string; mode: 'cycle'; cycleTicks: number };

export type ConnectionConfig = {
  seedProfile: string;
  signals: SimulatorSignalSeed[];
};

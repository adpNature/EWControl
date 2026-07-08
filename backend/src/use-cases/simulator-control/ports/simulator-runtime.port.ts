import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';

export const SIMULATOR_RUNTIME = Symbol('SimulatorRuntime');

/**
 * Acceso a las instancias en ejecución del Simulador de cada Machine (spec 02),
 * sin que el caso de uso conozca `SimulationProvider` ni ningún tipo de Interface
 * Adapters (Documento 0, regla de dependencia de Clean Architecture).
 */
export interface ISimulatorRuntime {
  isConnected(machineId: string): boolean;
  connect(machineId: string): Promise<void>;
  disconnect(machineId: string): Promise<void>;
  forceSignalQuality(
    machineId: string,
    variableName: string,
    quality: ForcedSignalQuality,
    durationTicks: number,
  ): void;
}

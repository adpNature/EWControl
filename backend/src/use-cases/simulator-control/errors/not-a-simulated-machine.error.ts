/**
 * Se lanza cuando se llama a un endpoint `/simulator/*` (spec 03-simulador-forzar-fallo.md)
 * sobre una Machine cuyo `MachineConnection.providerType` no es `Simulator`, o que no
 * tiene ninguna `MachineConnection` configurada.
 */
export class NotASimulatedMachineError extends Error {
  constructor(machineId: string) {
    super(`La Machine "${machineId}" no está configurada en modo Simulator.`);
    this.name = 'NotASimulatedMachineError';
  }
}

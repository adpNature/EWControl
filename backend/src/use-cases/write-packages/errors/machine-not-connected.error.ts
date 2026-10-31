export class MachineNotConnectedError extends Error {
  constructor(machineId: string) {
    super(`La Machine ${machineId} no está conectada a su PLC.`);
    this.name = 'MachineNotConnectedError';
  }
}

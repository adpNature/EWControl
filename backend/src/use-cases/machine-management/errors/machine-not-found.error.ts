export class MachineNotFoundError extends Error {
  constructor(machineId: string) {
    super(`No existe la Machine ${machineId}.`);
    this.name = 'MachineNotFoundError';
  }
}

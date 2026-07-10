export class MachineInactiveError extends Error {
  constructor(machineId: string) {
    super(`La Machine ${machineId} está desactivada.`);
    this.name = 'MachineInactiveError';
  }
}

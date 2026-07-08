/** Se lanza cuando no existe ninguna Machine con el `machineId` indicado. */
export class MachineNotFoundError extends Error {
  constructor(machineId: string) {
    super(`No existe la Machine "${machineId}".`);
    this.name = 'MachineNotFoundError';
  }
}

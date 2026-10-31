export class WriteInProgressError extends Error {
  constructor(machineId: string) {
    super(`Ya hay una escritura en curso en la Machine ${machineId}.`);
    this.name = 'WriteInProgressError';
  }
}

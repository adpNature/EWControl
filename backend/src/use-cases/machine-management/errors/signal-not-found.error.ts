export class SignalNotFoundError extends Error {
  constructor(signalId: string, machineId: string) {
    super(`No existe la Signal ${signalId} en la Machine ${machineId}.`);
    this.name = 'SignalNotFoundError';
  }
}

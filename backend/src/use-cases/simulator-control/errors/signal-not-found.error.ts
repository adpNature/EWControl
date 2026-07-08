/** Se lanza cuando `signalId` no existe o no pertenece a la Machine indicada. */
export class SignalNotFoundError extends Error {
  constructor(signalId: string, machineId: string) {
    super(`No existe la Signal "${signalId}" en la Machine "${machineId}".`);
    this.name = 'SignalNotFoundError';
  }
}

/**
 * A diferencia de `machine-management/errors/signal-not-found.error.ts`, las rutas
 * de Alarmas no llevan `:machineId` (docs/11-api-rest.md, sección "AlarmDefinition":
 * `/api/v1/signals/:signalId/alarm-definitions`), así que este error no lo exige.
 */
export class SignalNotFoundError extends Error {
  constructor(signalId: string) {
    super(`No existe la Signal ${signalId}.`);
    this.name = 'SignalNotFoundError';
  }
}

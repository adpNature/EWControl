/**
 * Se lanza cuando `POST /simulator/seed-history` (spec 04-simulador-seed-historico.md)
 * se llama sobre una Machine que ya tiene histórico generado en el rango solicitado,
 * sin pasar `force: true`.
 */
export class HistoryAlreadySeededError extends Error {
  constructor(machineId: string) {
    super(`La Machine "${machineId}" ya tiene histórico generado para este rango.`);
    this.name = 'HistoryAlreadySeededError';
  }
}

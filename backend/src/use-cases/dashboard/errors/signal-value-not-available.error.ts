/**
 * docs/specs/07-dashboard-tiempo-real.md: 404 SIGNAL_VALUE_NOT_AVAILABLE.
 * Misma respuesta tanto para una Signal FORMULA (sin Signal Engine que la resuelva
 * todavía) como para una Signal DIRECT que aún no ha recibido su primer tick —
 * la ausencia de entrada en la Realtime Cache es la única señal, sin distinguir el motivo.
 */
export class SignalValueNotAvailableError extends Error {
  constructor(signalId: string) {
    super(`No hay un valor disponible en la Realtime Cache para la Signal ${signalId}.`);
    this.name = 'SignalValueNotAvailableError';
  }
}

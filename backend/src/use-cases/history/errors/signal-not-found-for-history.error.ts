/** docs/specs/14-historicos-comparativas.md: 422 SIGNAL_NOT_FOUND_FOR_HISTORY. */
export class SignalNotFoundForHistoryError extends Error {
  constructor(public readonly signalIds: string[]) {
    super(
      `Las siguientes Signals no existen, no están activas o son de otra Company: ${signalIds.join(', ')}.`,
    );
    this.name = 'SignalNotFoundForHistoryError';
  }
}

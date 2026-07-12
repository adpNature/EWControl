/** docs/specs/07-dashboard-tiempo-real.md: 422 SIGNAL_NOT_FOUND_FOR_WIDGET. */
export class SignalNotFoundForWidgetError extends Error {
  constructor(public readonly signalIds: string[]) {
    super(
      `Las siguientes Signals no existen, no están activas o son de otra Company: ${signalIds.join(', ')}.`,
    );
    this.name = 'SignalNotFoundForWidgetError';
  }
}

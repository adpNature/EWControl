import type { HistoryResolution } from './ports/history-reader.port';

const HOUR_MS = 60 * 60 * 1000;

const SIX_HOURS_MS = 6 * HOUR_MS;
const TWO_DAYS_MS = 2 * 24 * HOUR_MS;
const THIRTY_DAYS_MS = 30 * 24 * HOUR_MS;
const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * HOUR_MS;

/**
 * Infiere la resolución de agregación a partir del span solicitado cuando el
 * cliente no la indica explícitamente (docs/04-persistencia-de-datos.md §4.3,
 * docs/08-frontend-dashboard.md §8.7: el Frontend nunca elige la resolución).
 */
export function resolveHistoryResolution(from: Date, to: Date): HistoryResolution {
  const spanMs = to.getTime() - from.getTime();
  if (spanMs <= SIX_HOURS_MS) {
    return 'raw';
  }
  if (spanMs <= TWO_DAYS_MS) {
    return 'minute';
  }
  if (spanMs <= THIRTY_DAYS_MS) {
    return 'hour';
  }
  if (spanMs <= ONE_HUNDRED_EIGHTY_DAYS_MS) {
    return 'day';
  }
  return 'month';
}

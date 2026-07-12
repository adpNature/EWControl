export const HISTORY_READER = Symbol('HistoryReader');

export type HistoryResolution = 'raw' | 'minute' | 'hour' | 'day' | 'month';

export type HistoryQueryPoint = { timestamp: Date; value: number };

export type HistoryQueryParams = {
  signalId: string;
  from: Date;
  to: Date;
  resolution: HistoryResolution;
};

/**
 * Puerto de consulta de histórico por rango (docs/specs/08-historicos.md),
 * separado de `IHistoryWriter` porque cubre un caso de uso distinto (lectura
 * bajo demanda, no la "transacción lógica" del seed).
 */
export interface IHistoryReader {
  queryRange(params: HistoryQueryParams): Promise<HistoryQueryPoint[]>;
}

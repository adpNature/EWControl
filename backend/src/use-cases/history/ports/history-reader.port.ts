export const HISTORY_READER = Symbol('HistoryReader');

export type HistoryResolution = 'raw' | 'minute' | 'hour' | 'day' | 'month';

export type HistoryQueryPoint = { timestamp: Date; value: number };

export type HistoryQueryParams = {
  signalId: string;
  from: Date;
  to: Date;
  resolution: HistoryResolution;
};

export type HistoryQueryBatchParams = {
  signalIds: string[];
  from: Date;
  to: Date;
  resolution: HistoryResolution;
};

export type HistoryQueryBatchPoint = { signalId: string; timestamp: Date; value: number };

/**
 * Puerto de consulta de histórico por rango (docs/specs/08-historicos.md),
 * separado de `IHistoryWriter` porque cubre un caso de uso distinto (lectura
 * bajo demanda, no la "transacción lógica" del seed).
 */
export interface IHistoryReader {
  queryRange(params: HistoryQueryParams): Promise<HistoryQueryPoint[]>;
  /** docs/specs/14-historicos-comparativas.md: histórico de varias Signals en una sola consulta. */
  queryRangeBatch(params: HistoryQueryBatchParams): Promise<HistoryQueryBatchPoint[]>;
}

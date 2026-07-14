export const HISTORY_WRITER = Symbol('HistoryWriter');

/** Punto de histórico normalizado para InfluxDB (docs/04-persistencia-de-datos.md §4.3). */
export type HistoryPoint = {
  companyId: string;
  machineId: string;
  signalId: string;
  value: number;
  timestamp: Date;
};

/**
 * Puerto de escritura/consulta/borrado de histórico en InfluxDB (spec
 * 04-simulador-seed-historico.md). Un único puerto cubre las tres capacidades
 * porque la "transacción lógica" del seed (escribir todo o limpiar ante fallo)
 * las necesita cohesionadas en el mismo adaptador.
 */
export interface IHistoryWriter {
  writeBatch(points: HistoryPoint[]): Promise<void>;
  hasDataInRange(machineId: string, from: Date, to: Date): Promise<boolean>;
  deleteRange(machineId: string, from: Date, to: Date): Promise<void>;
  /**
   * docs/specs/10-gestion-companies-users.md, borrado físico de Company:
   * elimina todo el histórico de esa Company (todas sus Machines/Signals)
   * hasta `until`, mismo mecanismo que `deleteRange` pero por `company_id`.
   */
  deleteAllForCompany(companyId: string, until: Date): Promise<void>;
}

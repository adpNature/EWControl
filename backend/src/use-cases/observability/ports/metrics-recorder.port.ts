export const METRICS_RECORDER = Symbol('MetricsRecorder');

/**
 * Único puerto de métricas que cruza a `use-cases/` (docs/07-observabilidad-monitorizacion.md,
 * apartado 7.3; spec 15): el fallo de escritura de histórico en InfluxDB
 * (`ingest-signal-tick.use-case.ts`) es el único punto donde una métrica de
 * infraestructura solo es observable desde dentro de un caso de uso. Mismo
 * patrón que `IEventPublisher`/`IHistoryWriter`.
 */
export interface IMetricsRecorder {
  recordHistoryWriteError(): void;
}

/**
 * Configuración visual de un DashboardWidget, una por `WidgetType`
 * (Documento 3, apartados 3.4 "WidgetConfig" y 3.5 "WidgetType").
 */
export type ValueWidgetConfig = { decimals?: number; label?: string };

export type GaugeWidgetConfig = { min: number; max: number; decimals?: number };

/**
 * Sin campo de rango temporal: el widget CHART de esta spec solo acumula
 * puntos recibidos en vivo por WebSocket, sin consultar histórico
 * (docs/specs/07-dashboard-tiempo-real.md, "Contexto", punto 2).
 */
export type ChartWidgetConfig = { maxPoints?: number; yAxisLabel?: string };

export type TableWidgetConfig = { columns?: Array<'value' | 'quality' | 'timestamp'> };

/** Sin campos: el widget ALARM_LIST no tiene fuente de datos todavía (AlarmState no existe). */
export type AlarmListWidgetConfig = Record<string, never>;

export type WidgetConfig =
  | ValueWidgetConfig
  | GaugeWidgetConfig
  | ChartWidgetConfig
  | TableWidgetConfig
  | AlarmListWidgetConfig;

/**
 * Un GAUGE sin un rango `min < max` no puede representar una escala
 * (docs/specs/07-dashboard-tiempo-real.md, casos borde: `400` en creación/edición).
 */
export function isValidGaugeWidgetConfig(config: GaugeWidgetConfig): boolean {
  return (
    typeof config.min === 'number' && typeof config.max === 'number' && config.min < config.max
  );
}

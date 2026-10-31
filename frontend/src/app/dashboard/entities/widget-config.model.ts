/** Documento 3, apartado 3.4; docs/specs/07-dashboard-tiempo-real.md. */
export interface ValueWidgetConfig {
  decimals?: number;
  label?: string;
}

export interface GaugeWidgetConfig {
  min: number;
  max: number;
  decimals?: number;
}

/** Sin campo de rango temporal: solo buffer en vivo, sin consulta a histórico. */
export interface ChartWidgetConfig {
  maxPoints?: number;
  yAxisLabel?: string;
}

export interface TableWidgetConfig {
  columns?: Array<'value' | 'quality' | 'timestamp'>;
}

/** Sin campos: el widget ALARM_LIST no tiene fuente de datos todavía. */
export type AlarmListWidgetConfig = Record<string, never>;

/** docs/specs/20-paquetes-escritura-opc-ua.md: el widget no lleva Signals, sino un paquete. */
export interface PackageWidgetConfig {
  machineId: string;
  writePackageId: string;
}

export type WidgetConfig =
  | ValueWidgetConfig
  | GaugeWidgetConfig
  | ChartWidgetConfig
  | TableWidgetConfig
  | AlarmListWidgetConfig
  | PackageWidgetConfig;

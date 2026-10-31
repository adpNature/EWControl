/**
 * Tipo de un DashboardWidget (Documento 3, apartado 3.5).
 */
export enum WidgetType {
  Value = 'VALUE',
  Chart = 'CHART',
  Gauge = 'GAUGE',
  Table = 'TABLE',
  AlarmList = 'ALARM_LIST',
  /** docs/specs/20-paquetes-escritura-opc-ua.md: botón para ejecutar un paquete de escritura. */
  Package = 'PACKAGE',
}

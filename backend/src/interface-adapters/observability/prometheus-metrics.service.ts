import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { IMetricsRecorder } from '../../use-cases/observability/ports/metrics-recorder.port';

/**
 * Métricas técnicas del Backend (docs/07-observabilidad-monitorizacion.md,
 * apartado 7.3; spec 15), expuestas por `MetricsController` (`GET /metrics`).
 * Única clase del proyecto que importa `prom-client`; el resto de
 * `interface-adapters/` que instrumenta una métrica (Gateway, registry del
 * Simulador) inyecta esta clase directamente, sin volver a tocar `prom-client`.
 */
@Injectable()
export class PrometheusMetricsService implements IMetricsRecorder {
  readonly registry = new Registry();

  private readonly signalUpdatesTotal = new Counter({
    name: 'ewcontrol_signal_updates_total',
    help: 'Número total de eventos SignalUpdated reemitidos por WebSocket',
    registers: [this.registry],
  });

  private readonly alarmEventsTotal = new Counter({
    name: 'ewcontrol_alarm_events_total',
    help: 'Número total de eventos de alarma reemitidos por WebSocket',
    labelNames: ['event'],
    registers: [this.registry],
  });

  private readonly dataProviderConnected = new Gauge({
    name: 'ewcontrol_data_provider_connected',
    help: 'Estado de conexión del Data Provider por Machine (1 conectado, 0 desconectado)',
    labelNames: ['machine_id'],
    registers: [this.registry],
  });

  /** docs/specs/18-integracion-opc-ua.md: aplazada en spec 15 hasta tener un Data Provider real. */
  private readonly dataProviderReconnectsTotal = new Counter({
    name: 'ewcontrol_data_provider_reconnects_total',
    help: 'Número de reconexiones del Data Provider por Machine tras una pérdida de conexión',
    labelNames: ['machine_id'],
    registers: [this.registry],
  });

  private readonly alarmActiveTotal = new Gauge({
    name: 'ewcontrol_alarm_active_total',
    help: 'Número de AlarmState con status ACTIVE',
    registers: [this.registry],
  });

  private readonly historyWriteErrorsTotal = new Counter({
    name: 'ewcontrol_history_write_errors_total',
    help: 'Número de fallos al escribir un punto de histórico en InfluxDB',
    registers: [this.registry],
  });

  private readonly writePackageExecutionsTotal = new Counter({
    name: 'ewcontrol_write_package_executions_total',
    help: 'Número de ejecuciones de paquetes de escritura por resultado (SUCCESS, PARTIAL, FAILED)',
    labelNames: ['status'],
    registers: [this.registry],
  });

  private readonly httpRequestsTotal = new Counter({
    name: 'ewcontrol_http_requests_total',
    help: 'Número total de peticiones HTTP',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  private readonly httpRequestDuration = new Histogram({
    name: 'ewcontrol_http_request_duration_seconds',
    help: 'Duración de las peticiones HTTP en segundos',
    labelNames: ['method', 'route', 'status_code'],
    registers: [this.registry],
  });

  incrementSignalUpdate(): void {
    this.signalUpdatesTotal.inc();
  }

  incrementAlarmEvent(event: string): void {
    this.alarmEventsTotal.inc({ event });
  }

  setDataProviderConnected(machineId: string, connected: boolean): void {
    // Nombre de label en snake_case: convención de Prometheus, no del proyecto.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.dataProviderConnected.set({ machine_id: machineId }, connected ? 1 : 0);
  }

  incrementDataProviderReconnect(machineId: string): void {
    // Nombre de label en snake_case: convención de Prometheus, no del proyecto.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.dataProviderReconnectsTotal.inc({ machine_id: machineId });
  }

  setAlarmActiveTotal(count: number): void {
    this.alarmActiveTotal.set(count);
  }

  recordHistoryWriteError(): void {
    this.historyWriteErrorsTotal.inc();
  }

  recordWritePackageExecution(status: string): void {
    this.writePackageExecutionsTotal.inc({ status });
  }

  observeHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    // Nombre de label en snake_case: convención de Prometheus, no del proyecto.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const labels = { method, route, status_code: String(statusCode) };
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

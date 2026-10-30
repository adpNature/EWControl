import { describe, expect, it } from 'vitest';
import { PrometheusMetricsService } from './prometheus-metrics.service';

describe('PrometheusMetricsService (docs/07-observabilidad-monitorizacion.md, apartado 7.3, spec 15)', () => {
  it('expone ewcontrol_signal_updates_total incrementado por incrementSignalUpdate()', async () => {
    const service = new PrometheusMetricsService();

    service.incrementSignalUpdate();
    service.incrementSignalUpdate();

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_signal_updates_total 2');
  });

  it('expone ewcontrol_alarm_events_total con label event', async () => {
    const service = new PrometheusMetricsService();

    service.incrementAlarmEvent('AlarmTriggered');

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_alarm_events_total{event="AlarmTriggered"} 1');
  });

  it('expone ewcontrol_data_provider_connected como gauge por machine_id', async () => {
    const service = new PrometheusMetricsService();

    service.setDataProviderConnected('machine-1', true);
    service.setDataProviderConnected('machine-2', false);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_data_provider_connected{machine_id="machine-1"} 1');
    expect(metrics).toContain('ewcontrol_data_provider_connected{machine_id="machine-2"} 0');
  });

  it('expone ewcontrol_data_provider_reconnects_total por machine_id (spec 18)', async () => {
    const service = new PrometheusMetricsService();

    service.incrementDataProviderReconnect('machine-1');
    service.incrementDataProviderReconnect('machine-1');

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_data_provider_reconnects_total{machine_id="machine-1"} 2');
  });

  it('expone ewcontrol_alarm_active_total como gauge', async () => {
    const service = new PrometheusMetricsService();

    service.setAlarmActiveTotal(3);

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_alarm_active_total 3');
  });

  it('expone ewcontrol_history_write_errors_total incrementado por recordHistoryWriteError() (IMetricsRecorder)', async () => {
    const service = new PrometheusMetricsService();

    service.recordHistoryWriteError();

    const metrics = await service.getMetrics();
    expect(metrics).toContain('ewcontrol_history_write_errors_total 1');
  });

  it('expone ewcontrol_http_requests_total y ewcontrol_http_request_duration_seconds vía observeHttpRequest()', async () => {
    const service = new PrometheusMetricsService();

    service.observeHttpRequest('GET', '/api/v1/machines', 200, 0.05);

    const metrics = await service.getMetrics();
    expect(metrics).toContain(
      'ewcontrol_http_requests_total{method="GET",route="/api/v1/machines",status_code="200"} 1',
    );
    expect(metrics).toContain('ewcontrol_http_request_duration_seconds_count');
  });
});

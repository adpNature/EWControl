import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmActiveCollector } from '../../observability/alarm-active.collector';
import { PrometheusMetricsService } from '../../observability/prometheus-metrics.service';
import { MetricsController } from './metrics.controller';

describe('MetricsController (HTTP, docs/specs/15-observabilidad-tecnica.md)', () => {
  let app: INestApplication;
  let metrics: PrometheusMetricsService;
  let alarmActiveCollector: { countActive: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    metrics = new PrometheusMetricsService();
    alarmActiveCollector = { countActive: vi.fn().mockResolvedValue(2) };

    const moduleRef = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        { provide: PrometheusMetricsService, useValue: metrics },
        { provide: AlarmActiveCollector, useValue: alarmActiveCollector },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /metrics expone las métricas de ewcontrol en formato Prometheus', async () => {
    metrics.incrementSignalUpdate();
    metrics.observeHttpRequest('GET', '/api/v1/machines', 200, 0.05);

    const response = await request(app.getHttpServer()).get('/metrics').expect(200);

    expect(alarmActiveCollector.countActive).toHaveBeenCalled();
    expect(response.text).toContain('ewcontrol_signal_updates_total');
    expect(response.text).toContain('ewcontrol_alarm_active_total 2');
    expect(response.text).toContain('ewcontrol_http_requests_total');
    expect(response.text).toContain('ewcontrol_http_request_duration_seconds');
  });
});

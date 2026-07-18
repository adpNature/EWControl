import { Controller, Get, Header } from '@nestjs/common';
import { contentType } from 'prom-client';
import { publicRoute } from '../../auth-guard/public.decorator';
import { AlarmActiveCollector } from '../../observability/alarm-active.collector';
import { PrometheusMetricsService } from '../../observability/prometheus-metrics.service';

/**
 * Endpoint `/metrics` scrapeado por Prometheus (docs/07-observabilidad-monitorizacion.md,
 * apartado 7.3; spec 15). Excluido del prefijo versionado `api/v1` (`main.ts`)
 * y del `JwtAuthGuard` global (`publicRoute()`): lo scrapea Prometheus, no un
 * usuario autenticado del Frontend.
 */
@Controller('metrics')
@publicRoute()
export class MetricsController {
  constructor(
    private readonly metrics: PrometheusMetricsService,
    private readonly alarmActiveCollector: AlarmActiveCollector,
  ) {}

  @Get()
  @Header('Content-Type', contentType)
  async getMetrics(): Promise<string> {
    const activeCount = await this.alarmActiveCollector.countActive();
    this.metrics.setAlarmActiveTotal(activeCount);
    return this.metrics.getMetrics();
  }
}

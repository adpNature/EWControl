import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlarmState } from '../entities/alarm-state.entity';
import { AlarmActiveCollector } from '../interface-adapters/observability/alarm-active.collector';
import { PrometheusMetricsService } from '../interface-adapters/observability/prometheus-metrics.service';
import { MetricsController } from '../interface-adapters/rest/health/metrics.controller';
import { METRICS_RECORDER } from '../use-cases/observability/ports/metrics-recorder.port';

/**
 * Métricas Prometheus (docs/07-observabilidad-monitorizacion.md, apartado 7.3;
 * spec 15), mismo estilo que `alarms.module.ts`. Único dueño de
 * `PrometheusMetricsService`: cualquier módulo que necesite instrumentar una
 * métrica (`DashboardModule` para `RealtimeGateway`, `SimulatorModule` para
 * `IngestSignalTickUseCase`/`SimulationProviderRegistry`) importa este módulo
 * para compartir la misma instancia (mismo registro Prometheus), igual que
 * `DashboardModule` exporta `REALTIME_CACHE` como instancia única compartida.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AlarmState])],
  controllers: [MetricsController],
  providers: [
    PrometheusMetricsService,
    AlarmActiveCollector,
    { provide: METRICS_RECORDER, useExisting: PrometheusMetricsService },
  ],
  exports: [PrometheusMetricsService, METRICS_RECORDER],
})
export class MetricsModule {}

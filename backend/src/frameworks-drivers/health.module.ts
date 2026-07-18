import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { InfluxDbHealthIndicator } from '../interface-adapters/persistence/influxdb/influxdb-health.indicator';
import { HealthController } from '../interface-adapters/rest/health/health.controller';

/**
 * Health checks del Backend (docs/07-observabilidad-monitorizacion.md, apartado
 * 7.5; spec 15), mismo estilo que `alarms.module.ts`.
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [InfluxDbHealthIndicator],
})
export class HealthModule {}

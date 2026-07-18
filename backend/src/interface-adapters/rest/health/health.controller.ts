import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { publicRoute } from '../../auth-guard/public.decorator';
import { InfluxDbHealthIndicator } from '../../persistence/influxdb/influxdb-health.indicator';

/**
 * Health checks del Backend (docs/07-observabilidad-monitorizacion.md, apartado
 * 7.5; spec 15). Excluido del prefijo versionado `api/v1` (`main.ts`) y del
 * `JwtAuthGuard` global (`publicRoute()`): lo consultan Docker/Prometheus, no
 * un usuario autenticado del Frontend.
 */
@Controller('health')
@publicRoute()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrm: TypeOrmHealthIndicator,
    private readonly influxDb: InfluxDbHealthIndicator,
  ) {}

  /**
   * Liveness: confirma únicamente que el proceso responde, sin ejecutar
   * ningún indicator — su fallo provoca el reinicio del contenedor, así que
   * debe ser el camino de código más simple posible.
   */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /**
   * Readiness: PostgreSQL e InfluxDB deben responder para que el Backend se
   * considere listo para recibir tráfico. Su fallo nunca reinicia el proceso.
   */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.typeOrm.pingCheck('postgres'),
      () => this.influxDb.isHealthy('influxdb'),
    ]);
  }
}

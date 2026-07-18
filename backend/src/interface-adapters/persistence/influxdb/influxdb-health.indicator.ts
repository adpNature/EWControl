import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { influxdbConnectionOptions } from '../../../frameworks-drivers/config/influxdb.config';

/**
 * Comprueba el endpoint nativo `/health` de InfluxDB 2.x (docs/07-observabilidad-monitorizacion.md,
 * apartado 7.5), el mismo que ya usa el healthcheck `influx ping` de `docker-compose.yml`. Se usa
 * solo en `GET /health/ready` (spec 15): un fallo nunca reinicia el proceso, solo indica que el
 * Backend no está listo para recibir tráfico.
 */
@Injectable()
export class InfluxDbHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const { url } = influxdbConnectionOptions();
    try {
      const response = await fetch(`${url}/health`);
      if (!response.ok) {
        return indicator.down({ httpStatus: response.status });
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: (error as Error).message });
    }
  }
}

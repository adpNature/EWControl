import { INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InfluxDbHealthIndicator } from '../../persistence/influxdb/influxdb-health.indicator';
import { HealthController } from './health.controller';

describe('HealthController (HTTP, docs/specs/15-observabilidad-tecnica.md)', () => {
  let app: INestApplication;
  let healthCheckService: { check: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    healthCheckService = { check: vi.fn() };
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: healthCheckService },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: vi.fn() } },
        { provide: InfluxDbHealthIndicator, useValue: { isHealthy: vi.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health/live responde 200 sin invocar HealthCheckService', async () => {
    await request(app.getHttpServer()).get('/health/live').expect(200, { status: 'ok' });

    expect(healthCheckService.check).not.toHaveBeenCalled();
  });

  it('GET /health/ready responde 200 cuando PostgreSQL e InfluxDB están disponibles', async () => {
    healthCheckService.check.mockResolvedValue({
      status: 'ok',
      info: { postgres: { status: 'up' }, influxdb: { status: 'up' } },
      details: { postgres: { status: 'up' }, influxdb: { status: 'up' } },
    });

    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('GET /health/ready responde 503 cuando PostgreSQL o InfluxDB fallan, sin afectar a /health/live', async () => {
    healthCheckService.check.mockRejectedValue(
      new ServiceUnavailableException({
        status: 'error',
        error: { influxdb: { status: 'down' } },
        details: { postgres: { status: 'up' }, influxdb: { status: 'down' } },
      }),
    );

    await request(app.getHttpServer()).get('/health/ready').expect(503);
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });
});

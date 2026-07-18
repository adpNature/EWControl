import { afterEach, describe, expect, it, vi } from 'vitest';
import { InfluxDbHealthIndicator } from './influxdb-health.indicator';

function createHealthIndicatorService() {
  const session = {
    up: vi.fn().mockReturnValue({ influxdb: { status: 'up' } }),
    down: vi.fn().mockReturnValue({ influxdb: { status: 'down' } }),
  };
  const healthIndicatorService = { check: vi.fn().mockReturnValue(session) };
  return { healthIndicatorService, session };
}

describe('InfluxDbHealthIndicator (docs/07-observabilidad-monitorizacion.md, apartado 7.5, spec 15)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marca up cuando el endpoint nativo /health de InfluxDB responde ok', async () => {
    const { healthIndicatorService, session } = createHealthIndicatorService();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const indicator = new InfluxDbHealthIndicator(healthIndicatorService as never);

    await indicator.isHealthy('influxdb');

    expect(healthIndicatorService.check).toHaveBeenCalledWith('influxdb');
    expect(session.up).toHaveBeenCalled();
    expect(session.down).not.toHaveBeenCalled();
  });

  it('marca down cuando el endpoint /health responde con un status distinto de 2xx', async () => {
    const { healthIndicatorService, session } = createHealthIndicatorService();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const indicator = new InfluxDbHealthIndicator(healthIndicatorService as never);

    await indicator.isHealthy('influxdb');

    expect(session.down).toHaveBeenCalled();
    expect(session.up).not.toHaveBeenCalled();
  });

  it('marca down cuando la petición fetch lanza (InfluxDB inaccesible)', async () => {
    const { healthIndicatorService, session } = createHealthIndicatorService();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));
    const indicator = new InfluxDbHealthIndicator(healthIndicatorService as never);

    await indicator.isHealthy('influxdb');

    expect(session.down).toHaveBeenCalled();
    expect(session.up).not.toHaveBeenCalled();
  });
});

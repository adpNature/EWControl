/**
 * Test de integración (Documento 0, "Pirámide de Testing"): arranca los módulos
 * Nest reales y golpea el Postgres/InfluxDB reales de `docker compose`, sin pasar
 * por HTTP. Usa `rangeMs` (parámetro interno de `SeedHistoryUseCase`, no expuesto
 * en el DTO REST) para ejercitar el algoritmo real de batching/limpieza-ante-fallo
 * en segundos en vez de los 7 días/1s de producción — ver plan de la spec 04.
 */
import { INestApplicationContext } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { InfluxDB } from '@influxdata/influxdb-client';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInfluxDbClient } from '../src/frameworks-drivers/database/influxdb.client';
import { influxdbConnectionOptions } from '../src/frameworks-drivers/config/influxdb.config';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { SimulatorModule } from '../src/frameworks-drivers/simulator.module';
import { InfluxDbHistoryRepository } from '../src/interface-adapters/persistence/influxdb/influxdb-history.repository';
import { HISTORY_WRITER, IHistoryWriter } from '../src/use-cases/history/ports/history-writer.port';
import { SeedHistoryUseCase } from '../src/use-cases/history/seed-history.use-case';
import { HistoryAlreadySeededError } from '../src/use-cases/history/errors/history-already-seeded.error';
import { SeedDemoEnvironmentUseCase } from '../src/use-cases/seed-demo-environment/seed-demo-environment.use-case';

async function truncateFoundationTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function countPointsInRange(
  client: InfluxDB,
  machineId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const { org, bucket } = influxdbConnectionOptions();
  // Flux `range()` trata `stop` como exclusivo; el seed escribe un punto exactamente
  // en `to`, así que se ensancha 1ms para incluir ese último tick en el conteo.
  const inclusiveStop = new Date(to.getTime() + 1).toISOString();
  const flux = `from(bucket: "${bucket}")
    |> range(start: ${from.toISOString()}, stop: ${inclusiveStop})
    |> filter(fn: (r) => r._measurement == "signal_values" and r.machine_id == "${machineId}")
    |> filter(fn: (r) => r.signal_id != "")
    |> count()`;
  const rows = await client.getQueryApi(org).collectRows<{ _value: number }>(flux);
  return rows.reduce((sum, row) => sum + row._value, 0);
}

describe('SeedHistoryUseCase (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let influxClient: InfluxDB;
  const seededMachineIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, SimulatorModule, EventEmitterModule.forRoot()],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    influxClient = createInfluxDbClient();
  });

  beforeEach(async () => {
    await truncateFoundationTables(dataSource);
  });

  afterAll(async () => {
    await truncateFoundationTables(dataSource);
    const historyWriter = app.get<IHistoryWriter>(HISTORY_WRITER);
    const wideFrom = new Date(0);
    const wideTo = new Date(Date.now() + 24 * 60 * 60 * 1000);
    for (const machineId of seededMachineIds) {
      await historyWriter.deleteRange(machineId, wideFrom, wideTo);
    }
    await app.close();
  });

  async function seedDemoMachine(): Promise<string> {
    await app.get(SeedDemoEnvironmentUseCase).execute();
    const [machine] = await dataSource.query('SELECT id FROM machines LIMIT 1');
    seededMachineIds.push(machine.id);
    return machine.id;
  }

  it('genera histórico sin huecos para el rango sembrado', async () => {
    const machineId = await seedDemoMachine();
    const useCase = app.get(SeedHistoryUseCase);
    const rangeMs = 5000;

    const result = await useCase.execute({ machineId, rangeMs });

    expect(result.signalsSeeded).toBe(6);
    const totalPoints = await countPointsInRange(influxClient, machineId, result.from, result.to);
    // 6 ticks (0..5000 cada 1000ms) * 6 Signals DIRECT+historyEnabled de la seed demo
    expect(totalPoints).toBe(6 * 6);
  });

  it('no permite sembrar dos veces sobre el mismo rango sin force', async () => {
    const machineId = await seedDemoMachine();
    const useCase = app.get(SeedHistoryUseCase);

    await useCase.execute({ machineId, rangeMs: 3000 });

    await expect(useCase.execute({ machineId, rangeMs: 3000 })).rejects.toBeInstanceOf(
      HistoryAlreadySeededError,
    );
  });

  it('con force:true borra el rango y regenera sin duplicar puntos', async () => {
    const machineId = await seedDemoMachine();
    const useCase = app.get(SeedHistoryUseCase);
    const rangeMs = 3000;

    const first = await useCase.execute({ machineId, rangeMs });
    const second = await useCase.execute({ machineId, rangeMs, force: true });

    const totalPoints = await countPointsInRange(influxClient, machineId, second.from, second.to);
    // 4 ticks (0..3000 cada 1000ms) * 6 Signals — igual que un único seed, no el doble
    expect(totalPoints).toBe(4 * 6);
    expect(second.from.getTime()).toBeGreaterThanOrEqual(first.from.getTime());
  });

  it('no deja histórico parcial si InfluxDB falla a mitad de la operación', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, SimulatorModule, EventEmitterModule.forRoot()],
    })
      .overrideProvider(HISTORY_WRITER)
      .useFactory({
        factory: (): IHistoryWriter => {
          const real = new InfluxDbHistoryRepository(createInfluxDbClient());
          let writeCalls = 0;
          return {
            writeBatch: async (points) => {
              writeCalls += 1;
              if (writeCalls === 2) {
                throw new Error('fallo forzado en el 2º lote');
              }
              return real.writeBatch(points);
            },
            hasDataInRange: (machineId, from, to) => real.hasDataInRange(machineId, from, to),
            deleteRange: (machineId, from, to) => real.deleteRange(machineId, from, to),
          };
        },
      })
      .compile();

    const failingApp = moduleRef.createNestApplication();
    await failingApp.init();
    const failingDataSource = failingApp.get<DataSource>(getDataSourceToken());

    await truncateFoundationTables(failingDataSource);
    await failingApp.get(SeedDemoEnvironmentUseCase).execute();
    const [machine] = await failingDataSource.query('SELECT id FROM machines LIMIT 1');
    seededMachineIds.push(machine.id);

    const useCase = failingApp.get(SeedHistoryUseCase);
    // 1000 ticks * 6 Signals = 6000 puntos: cruza el BATCH_SIZE (5000) en 2 lotes,
    // así que el 1º lote se escribe de verdad en InfluxDB antes de que falle el 2º.
    await expect(useCase.execute({ machineId: machine.id, rangeMs: 999_000 })).rejects.toThrow(
      'fallo forzado en el 2º lote',
    );

    // El propio use-case ya reintenta el borrado de limpieza internamente
    // (deleteRangeBestEffort) para cubrir la consistencia eventual de InfluxDB
    // entre una escritura reciente y el borrado que la alcanza.
    const historyWriter = failingApp.get<IHistoryWriter>(HISTORY_WRITER);
    const hasData = await historyWriter.hasDataInRange(
      machine.id,
      new Date(0),
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    expect(hasData).toBe(false);

    await failingApp.close();
  });
});

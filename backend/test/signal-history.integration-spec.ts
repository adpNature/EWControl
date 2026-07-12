/**
 * Test de integración (Documento 0, "Pirámide de Testing"): golpea InfluxDB
 * real vía `HistoryPersistenceModule`, mismo patrón que
 * `seed-history.integration-spec.ts`: escribe puntos conocidos con
 * `IHistoryWriter.writeBatch` y verifica `IHistoryReader.queryRange` (spec
 * 08-historicos.md) para cada resolución, sin pasar por HTTP.
 */
import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HistoryPersistenceModule } from '../src/frameworks-drivers/history-persistence.module';
import { HISTORY_READER, IHistoryReader } from '../src/use-cases/history/ports/history-reader.port';
import { HISTORY_WRITER, IHistoryWriter } from '../src/use-cases/history/ports/history-writer.port';

describe('InfluxDbHistoryRepository.queryRange (integration)', () => {
  let app: INestApplicationContext;
  let historyWriter: IHistoryWriter;
  let historyReader: IHistoryReader;
  const machineId = `machine-history-${Date.now()}`;
  const signalId = `signal-history-${Date.now()}`;
  const companyId = 'company-history-test';
  const from = new Date('2026-01-01T00:00:00Z');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HistoryPersistenceModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    historyWriter = app.get<IHistoryWriter>(HISTORY_WRITER);
    historyReader = app.get<IHistoryReader>(HISTORY_READER);

    await historyWriter.writeBatch([
      { companyId, machineId, signalId, value: 10, timestamp: new Date(from.getTime()) },
      { companyId, machineId, signalId, value: 20, timestamp: new Date(from.getTime() + 60_000) },
      { companyId, machineId, signalId, value: 30, timestamp: new Date(from.getTime() + 120_000) },
    ]);
  });

  afterAll(async () => {
    const wideTo = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    await historyWriter.deleteRange(machineId, from, wideTo);
    await app.close();
  });

  it('devuelve los puntos crudos sin agregación para resolution=raw', async () => {
    const points = await historyReader.queryRange({
      signalId,
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'raw',
    });

    expect(points).toHaveLength(3);
    expect(points.map((p) => p.value)).toEqual([10, 20, 30]);
  });

  it('devuelve la media agregada por ventana para resolution=hour', async () => {
    const points = await historyReader.queryRange({
      signalId,
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'hour',
    });

    expect(points).toHaveLength(1);
    expect(points[0].value).toBeCloseTo(20, 5);
  });

  it('devuelve [] para un rango sin datos', async () => {
    const emptyFrom = new Date(from.getTime() - 24 * 60 * 60 * 1000);
    const emptyTo = new Date(from.getTime() - 23 * 60 * 60 * 1000);

    const points = await historyReader.queryRange({
      signalId,
      from: emptyFrom,
      to: emptyTo,
      resolution: 'raw',
    });

    expect(points).toEqual([]);
  });

  it('devuelve [] para una Signal inexistente', async () => {
    const points = await historyReader.queryRange({
      signalId: 'signal-does-not-exist',
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'raw',
    });

    expect(points).toEqual([]);
  });
});

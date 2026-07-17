/**
 * Test de integración (Documento 0, "Pirámide de Testing"): golpea InfluxDB
 * real vía `HistoryPersistenceModule`, mismo patrón que
 * `signal-history.integration-spec.ts`, para `IHistoryReader.queryRangeBatch`
 * (docs/specs/14-historicos-comparativas.md), sin pasar por HTTP.
 */
import { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HistoryPersistenceModule } from '../src/frameworks-drivers/history-persistence.module';
import { HISTORY_READER, IHistoryReader } from '../src/use-cases/history/ports/history-reader.port';
import { HISTORY_WRITER, IHistoryWriter } from '../src/use-cases/history/ports/history-writer.port';

describe('InfluxDbHistoryRepository.queryRangeBatch (integration)', () => {
  let app: INestApplicationContext;
  let historyWriter: IHistoryWriter;
  let historyReader: IHistoryReader;
  const machineId = `machine-history-batch-${Date.now()}`;
  const signalIdA = `signal-history-batch-a-${Date.now()}`;
  const signalIdB = `signal-history-batch-b-${Date.now()}`;
  const signalIdEmpty = `signal-history-batch-empty-${Date.now()}`;
  const companyId = 'company-history-batch-test';
  const from = new Date('2026-02-01T00:00:00Z');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HistoryPersistenceModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    historyWriter = app.get<IHistoryWriter>(HISTORY_WRITER);
    historyReader = app.get<IHistoryReader>(HISTORY_READER);

    await historyWriter.writeBatch([
      { companyId, machineId, signalId: signalIdA, value: 10, timestamp: new Date(from.getTime()) },
      {
        companyId,
        machineId,
        signalId: signalIdA,
        value: 20,
        timestamp: new Date(from.getTime() + 60_000),
      },
      {
        companyId,
        machineId,
        signalId: signalIdB,
        value: 100,
        timestamp: new Date(from.getTime()),
      },
      {
        companyId,
        machineId,
        signalId: signalIdB,
        value: 200,
        timestamp: new Date(from.getTime() + 60_000),
      },
    ]);
  });

  afterAll(async () => {
    const wideTo = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    await historyWriter.deleteRange(machineId, from, wideTo);
    await app.close();
  });

  it('devuelve los puntos crudos de cada Signal, sin mezclar sus series', async () => {
    const rows = await historyReader.queryRangeBatch({
      signalIds: [signalIdA, signalIdB],
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'raw',
    });

    const rowsA = rows.filter((row) => row.signalId === signalIdA);
    const rowsB = rows.filter((row) => row.signalId === signalIdB);
    expect(rowsA.map((row) => row.value)).toEqual([10, 20]);
    expect(rowsB.map((row) => row.value)).toEqual([100, 200]);
  });

  it('agrega la media por ventana de cada Signal de forma independiente', async () => {
    const rows = await historyReader.queryRangeBatch({
      signalIds: [signalIdA, signalIdB],
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'hour',
    });

    const rowA = rows.find((row) => row.signalId === signalIdA);
    const rowB = rows.find((row) => row.signalId === signalIdB);
    expect(rowA?.value).toBeCloseTo(15, 5);
    expect(rowB?.value).toBeCloseTo(150, 5);
  });

  it('devuelve [] para una Signal del lote sin lecturas en el rango', async () => {
    const rows = await historyReader.queryRangeBatch({
      signalIds: [signalIdA, signalIdEmpty],
      from,
      to: new Date(from.getTime() + 3 * 60_000),
      resolution: 'raw',
    });

    expect(rows.some((row) => row.signalId === signalIdEmpty)).toBe(false);
    expect(rows.some((row) => row.signalId === signalIdA)).toBe(true);
  });
});

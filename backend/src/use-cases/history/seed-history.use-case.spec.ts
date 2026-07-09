import { describe, expect, it, vi } from 'vitest';
import { SignalType } from '../../entities/signal-type.enum';
import { NotASimulatedMachineError } from '../simulator-control/errors/not-a-simulated-machine.error';
import { HistoryAlreadySeededError } from './errors/history-already-seeded.error';
import { SeedHistoryUseCase } from './seed-history.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE_ID = 'machine-1';
const COMPANY_ID = 'company-1';
const NOW = new Date('2026-07-09T00:00:00.000Z');

const CONNECTION = {
  connectionConfig: {
    seedProfile: 'test',
    signals: [
      { variableName: 'WindingSpeed', min: 0, max: 1200, stepMax: 15 },
      { variableName: 'RunStop', mode: 'cycle' as const, cycleTicks: 300 },
    ],
  },
};

function createSignals() {
  return [
    {
      id: 'signal-1',
      machineId: MACHINE_ID,
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'WindingSpeed' },
      historyEnabled: true,
    },
    {
      id: 'signal-2',
      machineId: MACHINE_ID,
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'RunStop' },
      historyEnabled: true,
    },
    {
      id: 'signal-3',
      machineId: MACHINE_ID,
      signalType: SignalType.FORMULA,
      signalSource: { variableName: 'Derived' },
      historyEnabled: true,
    },
    {
      id: 'signal-4',
      machineId: MACHINE_ID,
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'NoHistory' },
      historyEnabled: false,
    },
  ];
}

function createFakes() {
  const resolver = { resolve: vi.fn().mockResolvedValue(CONNECTION) };
  const machineRepository = {
    findById: vi.fn().mockResolvedValue({ id: MACHINE_ID, companyId: COMPANY_ID }),
  };
  const signalRepository = {
    findAllByMachineId: vi.fn().mockResolvedValue(createSignals()),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const historyWriter = {
    writeBatch: vi.fn().mockResolvedValue(undefined),
    hasDataInRange: vi.fn().mockResolvedValue(false),
    deleteRange: vi.fn().mockResolvedValue(undefined),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const randomSource = { next: vi.fn().mockReturnValue(0.5) };

  return {
    resolver,
    machineRepository,
    signalRepository,
    unitOfWork,
    historyWriter,
    clock,
    randomSource,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new SeedHistoryUseCase(
    fakes.resolver as never,
    fakes.machineRepository as never,
    fakes.signalRepository as never,
    fakes.unitOfWork as never,
    fakes.historyWriter as never,
    fakes.clock as never,
    fakes.randomSource as never,
  );
}

describe('SeedHistoryUseCase', () => {
  it('genera y escribe puntos solo para Signals DIRECT con historyEnabled', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ machineId: MACHINE_ID, rangeMs: 2000 });

    expect(result.signalsSeeded).toBe(2);
    expect(fakes.historyWriter.writeBatch).toHaveBeenCalledTimes(1);
    const [points] = fakes.historyWriter.writeBatch.mock.calls[0];
    expect(points).toHaveLength(6);
    expect(points[0]).toMatchObject({
      companyId: COMPANY_ID,
      machineId: MACHINE_ID,
      signalId: 'signal-1',
    });
  });

  it('lanza HistoryAlreadySeededError si ya hay datos y no se pasa force', async () => {
    const fakes = createFakes();
    fakes.historyWriter.hasDataInRange.mockResolvedValue(true);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ machineId: MACHINE_ID, rangeMs: 2000 })).rejects.toBeInstanceOf(
      HistoryAlreadySeededError,
    );
    expect(fakes.historyWriter.writeBatch).not.toHaveBeenCalled();
    expect(fakes.historyWriter.deleteRange).not.toHaveBeenCalled();
  });

  it('con force=true borra el rango existente antes de regenerar', async () => {
    const fakes = createFakes();
    fakes.historyWriter.hasDataInRange.mockResolvedValue(true);
    const useCase = createUseCase(fakes);

    await useCase.execute({ machineId: MACHINE_ID, rangeMs: 2000, force: true });

    expect(fakes.historyWriter.deleteRange).toHaveBeenCalledTimes(1);
    expect(fakes.historyWriter.writeBatch).toHaveBeenCalled();
  });

  it('propaga el error del resolver sin envolverlo', async () => {
    const fakes = createFakes();
    fakes.resolver.resolve.mockRejectedValue(new NotASimulatedMachineError(MACHINE_ID));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ machineId: MACHINE_ID })).rejects.toBeInstanceOf(
      NotASimulatedMachineError,
    );
  });

  it('ante un fallo de escritura, borra el rango exacto y relanza el error original', async () => {
    const fakes = createFakes();
    const failure = new Error('InfluxDB no disponible');
    fakes.historyWriter.writeBatch.mockRejectedValue(failure);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ machineId: MACHINE_ID, rangeMs: 2000 })).rejects.toBe(failure);

    // se reintenta varias veces para cubrir la consistencia eventual de InfluxDB
    // entre una escritura reciente y el borrado de limpieza que la alcanza.
    expect(fakes.historyWriter.deleteRange).toHaveBeenCalledTimes(3);
    const [, from, to] = fakes.historyWriter.deleteRange.mock.calls[0];
    expect((to as Date).toISOString()).toBe(NOW.toISOString());
    expect((from as Date).toISOString()).toBe(new Date(NOW.getTime() - 2000).toISOString());
  });

  it('un fallo durante la limpieza no enmascara el error original', async () => {
    const fakes = createFakes();
    const failure = new Error('InfluxDB no disponible');
    fakes.historyWriter.writeBatch.mockRejectedValue(failure);
    fakes.historyWriter.deleteRange.mockRejectedValue(new Error('delete también falló'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ machineId: MACHINE_ID, rangeMs: 2000 })).rejects.toBe(failure);
  });
});

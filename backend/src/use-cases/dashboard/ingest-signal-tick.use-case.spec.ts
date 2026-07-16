import { describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { IngestSignalTickUseCase } from './ingest-signal-tick.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true, historyEnabled: true };
const NOW = new Date('2026-07-12T10:00:05Z');
const TICK_TIMESTAMP = new Date('2026-07-12T10:00:00Z');

function createFakes() {
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(MACHINE),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    findActiveDirectByMachineAndVariableName: vi.fn().mockResolvedValue(SIGNAL),
    findActiveFormulasByMachineAndVariableName: vi.fn().mockResolvedValue([]),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const realtimeCache = { get: vi.fn(), set: vi.fn() };
  // Fake con estado real (no solo espías desconectados): igual que
  // `InMemoryRawVariableCache`, para que un `set()` dentro de `execute()` sea
  // visible a los `get()` posteriores del mismo test, sin tener que precalcular
  // manualmente qué debe devolver cada `get()`.
  const rawVariableStore = new Map<
    string,
    { value: unknown; quality: SignalQuality; timestamp: Date }
  >();
  const rawVariableCache = {
    get: vi.fn((machineId: string, variableName: string) =>
      rawVariableStore.get(`${machineId}:${variableName}`),
    ),
    set: vi.fn(
      (
        machineId: string,
        variableName: string,
        entry: { value: unknown; quality: SignalQuality; timestamp: Date },
      ) => rawVariableStore.set(`${machineId}:${variableName}`, entry),
    ),
  };
  const eventPublisher = { publish: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const historyWriter = { writeBatch: vi.fn(), hasDataInRange: vi.fn(), deleteRange: vi.fn() };
  return {
    machineRepository,
    signalRepository,
    realtimeCache,
    rawVariableCache,
    eventPublisher,
    unitOfWork,
    clock,
    historyWriter,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new IngestSignalTickUseCase(
    fakes.machineRepository,
    fakes.signalRepository,
    fakes.realtimeCache,
    fakes.rawVariableCache,
    fakes.eventPublisher,
    fakes.unitOfWork,
    fakes.clock,
    fakes.historyWriter,
  );
}

describe('IngestSignalTickUseCase — Signal DIRECT (docs/specs/07-dashboard-tiempo-real.md)', () => {
  it('actualiza la Realtime Cache y publica SignalUpdated para una Signal DIRECT activa', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'temperature',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledWith({
      signalId: 'signal-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
      updatedAt: NOW,
    });
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('SignalUpdated', {
      signalId: 'signal-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    expect(fakes.historyWriter.writeBatch).toHaveBeenCalledWith([
      {
        companyId: 'company-1',
        machineId: 'machine-1',
        signalId: 'signal-1',
        value: 24.8,
        timestamp: TICK_TIMESTAMP,
      },
    ]);
  });

  it('no escribe en InfluxDB si la Signal tiene historyEnabled: false', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue({
      ...SIGNAL,
      historyEnabled: false,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'temperature',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalled();
    expect(fakes.historyWriter.writeBatch).not.toHaveBeenCalled();
  });

  it('no propaga el error si IHistoryWriter.writeBatch falla (tolerancia a fallos)', async () => {
    const fakes = createFakes();
    fakes.historyWriter.writeBatch.mockRejectedValue(new Error('InfluxDB no disponible'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        variableName: 'temperature',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp: TICK_TIMESTAMP,
      }),
    ).resolves.toBeUndefined();
    expect(fakes.realtimeCache.set).toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).toHaveBeenCalled();
  });

  it('descarta el tick silenciosamente si la Machine no existe', async () => {
    const fakes = createFakes();
    fakes.machineRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'missing-machine',
      variableName: 'temperature',
      value: 1,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
    expect(fakes.rawVariableCache.set).not.toHaveBeenCalled();
  });

  it('descarta el tick silenciosamente si la Machine está inactiva', async () => {
    const fakes = createFakes();
    fakes.machineRepository.findById.mockResolvedValue({ ...MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'temperature',
      value: 1,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.rawVariableCache.set).not.toHaveBeenCalled();
  });

  it('descarta el tick silenciosamente si variableName no corresponde a ninguna Signal DIRECT activa', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'unknown-variable',
      value: 1,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

describe('IngestSignalTickUseCase — Signal FORMULA (docs/specs/13-motor-formulas-signal-engine.md)', () => {
  it('memoriza el tick en el RawVariableCache para cualquier Machine activa, tenga o no una Signal DIRECT', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Voltage',
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.rawVariableCache.set).toHaveBeenCalledWith('machine-1', 'Voltage', {
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
  });

  it('calcula una FORMULA cuando todas sus Variables ya tienen valor conocido y publica SignalUpdated con el mismo contrato que una DIRECT', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-power',
        machineId: 'machine-1',
        signalSource: { expression: 'Voltage * Current', variables: ['Voltage', 'Current'] },
        historyEnabled: true,
      },
    ]);
    fakes.rawVariableCache.set('machine-1', 'Current', {
      value: 12,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-12T09:59:00Z'),
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Voltage',
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledWith({
      signalId: 'signal-power',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 2760,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
      updatedAt: NOW,
    });
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('SignalUpdated', {
      signalId: 'signal-power',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 2760,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    expect(fakes.historyWriter.writeBatch).toHaveBeenCalledWith([
      {
        companyId: 'company-1',
        machineId: 'machine-1',
        signalId: 'signal-power',
        value: 2760,
        timestamp: TICK_TIMESTAMP,
      },
    ]);
  });

  it('omite el cálculo si alguna Variable de la fórmula todavía no ha tickeado nunca', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-power',
        machineId: 'machine-1',
        signalSource: { expression: 'Voltage * Current', variables: ['Voltage', 'Current'] },
        historyEnabled: true,
      },
    ]);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Voltage',
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
    expect(fakes.historyWriter.writeBatch).not.toHaveBeenCalled();
  });

  it('asigna la peor calidad y el timestamp más reciente entre las Variables usadas', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-power',
        machineId: 'machine-1',
        signalSource: { expression: 'Voltage * Current', variables: ['Voltage', 'Current'] },
        historyEnabled: false,
      },
    ]);
    fakes.rawVariableCache.set('machine-1', 'Current', {
      value: 12,
      quality: SignalQuality.Offline,
      timestamp: new Date('2026-07-12T09:00:00Z'),
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Voltage',
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledWith(
      expect.objectContaining({ quality: SignalQuality.Offline, timestamp: TICK_TIMESTAMP }),
    );
  });

  it('recalcula una FORMULA por cada Variable suya que ticka, incluso dentro del mismo ciclo', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-power',
        machineId: 'machine-1',
        signalSource: { expression: 'Voltage * Current', variables: ['Voltage', 'Current'] },
        historyEnabled: false,
      },
    ]);
    fakes.rawVariableCache.set('machine-1', 'Current', {
      value: 12,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Voltage',
      value: 230,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'Current',
      value: 15,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledTimes(2);
    expect(fakes.realtimeCache.set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ value: 230 * 12 }),
    );
    expect(fakes.realtimeCache.set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ value: 230 * 15 }),
    );
  });

  it('ante un error de cálculo (división por cero) con un último valor válido previo, lo conserva con calidad BAD', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-ratio',
        machineId: 'machine-1',
        signalSource: { expression: 'a / b', variables: ['a', 'b'] },
        historyEnabled: false,
      },
    ]);
    fakes.rawVariableCache.set('machine-1', 'b', {
      value: 0,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    const previousEntry = {
      signalId: 'signal-ratio',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 5,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-07-12T09:00:00Z'),
      updatedAt: new Date('2026-07-12T09:00:00Z'),
    };
    fakes.realtimeCache.get.mockReturnValue(previousEntry);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'a',
      value: 10,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledWith({
      signalId: 'signal-ratio',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 5,
      quality: SignalQuality.Bad,
      timestamp: TICK_TIMESTAMP,
      updatedAt: NOW,
    });
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('SignalUpdated', {
      signalId: 'signal-ratio',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 5,
      quality: SignalQuality.Bad,
      timestamp: TICK_TIMESTAMP,
    });
  });

  it('ante un error de cálculo sin ningún valor válido previo, omite la actualización', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveDirectByMachineAndVariableName.mockResolvedValue(null);
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-ratio',
        machineId: 'machine-1',
        signalSource: { expression: 'a / b', variables: ['a', 'b'] },
        historyEnabled: false,
      },
    ]);
    fakes.rawVariableCache.set('machine-1', 'b', {
      value: 0,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'a',
      value: 10,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('resuelve una Signal DIRECT y una o varias Signal FORMULA en el mismo tick, de forma independiente', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findActiveFormulasByMachineAndVariableName.mockResolvedValue([
      {
        id: 'signal-double',
        machineId: 'machine-1',
        signalSource: { expression: 'temperature * 2', variables: ['temperature'] },
        historyEnabled: false,
      },
    ]);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      variableName: 'temperature',
      value: 24.8,
      quality: SignalQuality.Good,
      timestamp: TICK_TIMESTAMP,
    });

    expect(fakes.realtimeCache.set).toHaveBeenCalledWith(
      expect.objectContaining({ signalId: 'signal-1', value: 24.8 }),
    );
    expect(fakes.realtimeCache.set).toHaveBeenCalledWith(
      expect.objectContaining({ signalId: 'signal-double', value: 49.6 }),
    );
  });
});

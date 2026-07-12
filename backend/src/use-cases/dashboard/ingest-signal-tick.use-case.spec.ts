import { describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { IngestSignalTickUseCase } from './ingest-signal-tick.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
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
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const realtimeCache = { get: vi.fn(), set: vi.fn() };
  const eventPublisher = { publish: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return { machineRepository, signalRepository, realtimeCache, eventPublisher, unitOfWork, clock };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new IngestSignalTickUseCase(
    fakes.machineRepository,
    fakes.signalRepository,
    fakes.realtimeCache,
    fakes.eventPublisher,
    fakes.unitOfWork,
    fakes.clock,
  );
}

describe('IngestSignalTickUseCase', () => {
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

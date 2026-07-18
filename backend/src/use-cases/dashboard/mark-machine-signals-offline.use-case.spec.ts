import { describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { MarkMachineSignalsOfflineUseCase } from './mark-machine-signals-offline.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-12T10:05:00Z');
const LAST_TIMESTAMP = new Date('2026-07-12T10:00:00Z');

function buildEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    signalId: 'signal-1',
    machineId: 'machine-1',
    companyId: 'company-1',
    value: 24.8,
    quality: SignalQuality.Good,
    timestamp: LAST_TIMESTAMP,
    updatedAt: LAST_TIMESTAMP,
    correlationId: 'correlation-1',
    ...overrides,
  };
}

function createFakes() {
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn().mockResolvedValue([{ id: 'signal-1' }, { id: 'signal-2' }]),
    findActiveDirectByMachineAndVariableName: vi.fn(),
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
  return { signalRepository, realtimeCache, eventPublisher, unitOfWork, clock };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new MarkMachineSignalsOfflineUseCase(
    fakes.signalRepository,
    fakes.realtimeCache,
    fakes.eventPublisher,
    fakes.unitOfWork,
    fakes.clock,
  );
}

describe('MarkMachineSignalsOfflineUseCase', () => {
  it('marca OFFLINE conservando value/timestamp para cada Signal con entrada en la Realtime Cache', async () => {
    const fakes = createFakes();
    fakes.realtimeCache.get.mockImplementation((signalId: string) =>
      signalId === 'signal-1' ? buildEntry() : undefined,
    );
    const useCase = createUseCase(fakes);

    await useCase.execute({ machineId: 'machine-1', companyId: 'company-1' });

    expect(fakes.realtimeCache.set).toHaveBeenCalledTimes(1);
    expect(fakes.realtimeCache.set).toHaveBeenCalledWith({
      ...buildEntry(),
      quality: SignalQuality.Offline,
      updatedAt: NOW,
    });
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('SignalUpdated', {
      signalId: 'signal-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 24.8,
      quality: SignalQuality.Offline,
      timestamp: LAST_TIMESTAMP,
      correlationId: 'correlation-1',
    });
  });

  it('no hace nada para una Signal sin entrada en la Realtime Cache', async () => {
    const fakes = createFakes();
    fakes.realtimeCache.get.mockReturnValue(undefined);
    const useCase = createUseCase(fakes);

    await useCase.execute({ machineId: 'machine-1', companyId: 'company-1' });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('es idempotente: no vuelve a publicar si la Signal ya estaba OFFLINE', async () => {
    const fakes = createFakes();
    fakes.realtimeCache.get.mockImplementation((signalId: string) =>
      signalId === 'signal-1' ? buildEntry({ quality: SignalQuality.Offline }) : undefined,
    );
    const useCase = createUseCase(fakes);

    await useCase.execute({ machineId: 'machine-1', companyId: 'company-1' });

    expect(fakes.realtimeCache.set).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

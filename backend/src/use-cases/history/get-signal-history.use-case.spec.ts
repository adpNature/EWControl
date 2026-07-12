import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { SignalNotFoundError } from '../machine-management/errors/signal-not-found.error';
import { InvalidHistoryRangeError } from './errors/invalid-history-range.error';
import { GetSignalHistoryUseCase } from './get-signal-history.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const FROM = new Date('2026-07-11T08:00:00Z');
const TO = new Date('2026-07-12T10:00:00Z');
const POINTS = [{ timestamp: new Date('2026-07-12T09:30:00Z'), value: 24.8 }];

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue(MACHINE) };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(SIGNAL),
    findAllByMachineId: vi.fn(),
    findActiveDirectByMachineAndVariableName: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const historyReader = { queryRange: vi.fn().mockResolvedValue(POINTS) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, signalRepository, historyReader, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetSignalHistoryUseCase(
    fakes.resolver as never,
    fakes.signalRepository,
    fakes.historyReader,
    fakes.unitOfWork,
  );
}

const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

describe('GetSignalHistoryUseCase', () => {
  it('devuelve los puntos de IHistoryReader infiriendo la resolución del span', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      from: FROM,
      to: TO,
      requester: REQUESTER,
    });

    expect(result).toEqual({ signalId: 'signal-1', resolution: 'minute', points: POINTS });
    expect(fakes.historyReader.queryRange).toHaveBeenCalledWith({
      signalId: 'signal-1',
      from: FROM,
      to: TO,
      resolution: 'minute',
    });
  });

  it('respeta la resolución explícita sin inferirla', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      from: FROM,
      to: TO,
      resolution: 'raw',
      requester: REQUESTER,
    });

    expect(result.resolution).toBe('raw');
    expect(fakes.historyReader.queryRange).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: 'raw' }),
    );
  });

  it('devuelve points: [] cuando IHistoryReader no encuentra datos, sin lanzar error', async () => {
    const fakes = createFakes();
    fakes.historyReader.queryRange.mockResolvedValue([]);
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      from: FROM,
      to: TO,
      requester: REQUESTER,
    });

    expect(result.points).toEqual([]);
  });

  it('lanza InvalidHistoryRangeError si from >= to, sin consultar nada', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        from: TO,
        to: FROM,
        requester: REQUESTER,
      }),
    ).rejects.toBeInstanceOf(InvalidHistoryRangeError);
    expect(fakes.resolver.resolveActive).not.toHaveBeenCalled();
    expect(fakes.historyReader.queryRange).not.toHaveBeenCalled();
  });

  it('lanza SignalNotFoundError si la Signal no pertenece a la Machine resuelta', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, machineId: 'other-machine' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        from: FROM,
        to: TO,
        requester: REQUESTER,
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
    expect(fakes.historyReader.queryRange).not.toHaveBeenCalled();
  });
});

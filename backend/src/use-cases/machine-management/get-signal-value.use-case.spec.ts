import { describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { UserRole } from '../../entities/user-role.enum';
import { SignalValueNotAvailableError } from '../dashboard/errors/signal-value-not-available.error';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { GetSignalValueUseCase } from './get-signal-value.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const CACHE_ENTRY = {
  signalId: 'signal-1',
  machineId: 'machine-1',
  companyId: 'company-1',
  value: 24.8,
  quality: SignalQuality.Good,
  timestamp: new Date('2026-07-12T10:00:00Z'),
  updatedAt: new Date('2026-07-12T10:00:00Z'),
};

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
  const realtimeCache = { get: vi.fn().mockReturnValue(CACHE_ENTRY), set: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, signalRepository, realtimeCache, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetSignalValueUseCase(
    fakes.resolver as never,
    fakes.signalRepository,
    fakes.realtimeCache,
    fakes.unitOfWork,
  );
}

describe('GetSignalValueUseCase', () => {
  it('devuelve la entrada de la Realtime Cache cuando existe', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const entry = await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(entry).toEqual(CACHE_ENTRY);
  });

  it('lanza SignalValueNotAvailableError si no hay entrada en la Realtime Cache (FORMULA o sin tick aún)', async () => {
    const fakes = createFakes();
    fakes.realtimeCache.get.mockReturnValue(undefined);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(SignalValueNotAvailableError);
  });

  it('lanza SignalNotFoundError si la Signal no pertenece a la Machine resuelta', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, machineId: 'other-machine' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
    expect(fakes.realtimeCache.get).not.toHaveBeenCalled();
  });
});

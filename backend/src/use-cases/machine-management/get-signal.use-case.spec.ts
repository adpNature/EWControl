import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { GetSignalUseCase } from './get-signal.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue({ id: 'machine-1' }) };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(SIGNAL),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, signalRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetSignalUseCase(fakes.resolver as never, fakes.signalRepository, fakes.unitOfWork);
}

describe('GetSignalUseCase', () => {
  it('devuelve la Signal cuando pertenece a la Machine y está activa', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const signal = await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: REQUESTER,
    });

    expect(signal).toEqual(SIGNAL);
  });

  it('lanza SignalNotFoundError si la Signal no existe', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ machineId: 'machine-1', signalId: 'missing', requester: REQUESTER }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
  });

  it('lanza SignalNotFoundError si la Signal pertenece a otra Machine', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, machineId: 'other-machine' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ machineId: 'machine-1', signalId: 'signal-1', requester: REQUESTER }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
  });

  it('lanza SignalNotFoundError si la Signal está inactiva', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ machineId: 'machine-1', signalId: 'signal-1', requester: REQUESTER }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
  });
});

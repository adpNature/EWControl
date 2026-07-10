import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { DeleteSignalUseCase } from './delete-signal.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const SIGNAL = { id: 'signal-1', machineId: 'machine-1' };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(SIGNAL),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn().mockResolvedValue({ ...SIGNAL, isActive: false }),
    deactivateAllByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, signalRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new DeleteSignalUseCase(fakes.resolver as never, fakes.signalRepository, fakes.unitOfWork);
}

describe('DeleteSignalUseCase', () => {
  it('desactiva la Signal (baja lógica)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ machineId: 'machine-1', signalId: 'signal-1', requester: REQUESTER });

    expect(fakes.signalRepository.softDeactivate).toHaveBeenCalledWith('signal-1', FAKE_CTX);
  });

  it('lanza SignalNotFoundError si la Signal no pertenece a la Machine', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...SIGNAL, machineId: 'other' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ machineId: 'machine-1', signalId: 'signal-1', requester: REQUESTER }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
    expect(fakes.signalRepository.softDeactivate).not.toHaveBeenCalled();
  });

  it('lanza MachineInactiveError si la Machine está desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({ machineId: 'machine-1', signalId: 'signal-1', requester: REQUESTER }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.signalRepository.softDeactivate).not.toHaveBeenCalled();
  });
});

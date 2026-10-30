import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { DeleteMachineUseCase } from './delete-machine.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn().mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false }),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const eventPublisher = { publish: vi.fn() };
  return { resolver, machineRepository, signalRepository, unitOfWork, eventPublisher };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new DeleteMachineUseCase(
    fakes.resolver as never,
    fakes.machineRepository,
    fakes.signalRepository,
    fakes.unitOfWork,
    fakes.eventPublisher,
  );
}

describe('DeleteMachineUseCase', () => {
  it('publica MachineDeactivated tras la baja para detener su Data Provider (spec 18)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineDeactivated', {
      machineId: 'machine-1',
      companyId: 'company-1',
    });
  });

  it('desactiva la Machine y en cascada todas sus Signals', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });

    expect(fakes.machineRepository.softDeactivate).toHaveBeenCalledWith('machine-1', FAKE_CTX);
    expect(fakes.signalRepository.deactivateAllByMachineId).toHaveBeenCalledWith(
      'machine-1',
      FAKE_CTX,
    );
  });

  it('lanza MachineInactiveError si ya estaba inactiva (doble baja)', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.machineRepository.softDeactivate).not.toHaveBeenCalled();
    expect(fakes.signalRepository.deactivateAllByMachineId).not.toHaveBeenCalled();
  });
});

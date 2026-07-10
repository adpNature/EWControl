import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { UpdateMachineUseCase } from './update-machine.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Old', isActive: true };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn().mockResolvedValue({ ...ACTIVE_MACHINE, name: 'New' }),
    softDeactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, machineRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new UpdateMachineUseCase(
    fakes.resolver as never,
    fakes.machineRepository,
    fakes.unitOfWork,
  );
}

describe('UpdateMachineUseCase', () => {
  it('actualiza el name de la Machine resuelta', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const machine = await useCase.execute({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      name: 'New',
    });

    expect(fakes.machineRepository.update).toHaveBeenCalledWith(
      'machine-1',
      { name: 'New' },
      FAKE_CTX,
    );
    expect(machine.name).toBe('New');
  });

  it('lanza MachineInactiveError si la Machine ya está desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        name: 'New',
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.machineRepository.update).not.toHaveBeenCalled();
  });
});

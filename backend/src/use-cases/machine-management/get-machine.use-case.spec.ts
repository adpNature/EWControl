import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { GetMachineUseCase } from './get-machine.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue({ id: 'machine-1' }) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetMachineUseCase(fakes.resolver as never, fakes.unitOfWork);
}

describe('GetMachineUseCase', () => {
  it('delega en el resolver y devuelve la Machine activa', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    const machine = await useCase.execute({ machineId: 'machine-1', requester });

    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('machine-1', requester, FAKE_CTX);
    expect(machine).toEqual({ id: 'machine-1' });
  });

  it('propaga MachineNotFoundError del resolver', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveActive.mockRejectedValue(new MachineNotFoundError('missing'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'missing',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(MachineNotFoundError);
  });
});

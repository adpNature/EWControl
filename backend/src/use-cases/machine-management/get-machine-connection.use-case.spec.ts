import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { GetMachineConnectionUseCase } from './get-machine-connection.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const CONNECTION = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: ProviderType.Simulator,
  connectionConfig: { seedProfile: 'empty', signals: [] },
};

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue({ id: 'machine-1' }) };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn().mockResolvedValue(CONNECTION),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, machineConnectionRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetMachineConnectionUseCase(
    fakes.resolver as never,
    fakes.machineConnectionRepository,
    fakes.unitOfWork,
  );
}

describe('GetMachineConnectionUseCase', () => {
  it('resuelve la Machine activa y devuelve su MachineConnection', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    const connection = await useCase.execute({ machineId: 'machine-1', requester });

    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('machine-1', requester, FAKE_CTX);
    expect(fakes.machineConnectionRepository.findByMachineId).toHaveBeenCalledWith(
      'machine-1',
      FAKE_CTX,
    );
    expect(connection).toEqual(CONNECTION);
  });
});

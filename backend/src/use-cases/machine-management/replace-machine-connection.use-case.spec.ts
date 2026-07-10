import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { ProviderNotSupportedError } from './errors/provider-not-supported.error';
import { ReplaceMachineConnectionUseCase } from './replace-machine-connection.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn(),
    findAllByProviderType: vi.fn(),
    replace: vi.fn().mockResolvedValue({
      id: 'connection-1',
      machineId: 'machine-1',
      providerType: ProviderType.Simulator,
      connectionConfig: { seedProfile: 'demo', signals: [] },
    }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, machineConnectionRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ReplaceMachineConnectionUseCase(
    fakes.resolver as never,
    fakes.machineConnectionRepository,
    fakes.unitOfWork,
  );
}

describe('ReplaceMachineConnectionUseCase', () => {
  it('reemplaza la MachineConnection cuando providerType es Simulator', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const connectionConfig = { seedProfile: 'demo', signals: [] };

    const connection = await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      providerType: ProviderType.Simulator,
      connectionConfig,
    });

    expect(fakes.machineConnectionRepository.replace).toHaveBeenCalledWith(
      'machine-1',
      { providerType: ProviderType.Simulator, connectionConfig },
      FAKE_CTX,
    );
    expect(connection.providerType).toBe(ProviderType.Simulator);
  });

  it('lanza ProviderNotSupportedError si providerType no es Simulator', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        providerType: ProviderType.OpcUa,
        connectionConfig: { seedProfile: 'demo', signals: [] },
      }),
    ).rejects.toBeInstanceOf(ProviderNotSupportedError);
    expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
    expect(fakes.resolver.resolveAny).not.toHaveBeenCalled();
  });

  it('lanza MachineInactiveError si la Machine está desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        providerType: ProviderType.Simulator,
        connectionConfig: { seedProfile: 'demo', signals: [] },
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
  });
});

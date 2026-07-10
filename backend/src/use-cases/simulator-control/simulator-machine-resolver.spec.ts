import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { NotASimulatedMachineError } from './errors/not-a-simulated-machine.error';
import { SimulatorMachineResolver } from './simulator-machine-resolver';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 'machine-1', companyId: 'company-1', name: 'Demo' }),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn().mockResolvedValue({
      id: 'connection-1',
      machineId: 'machine-1',
      providerType: ProviderType.Simulator,
      connectionConfig: { seedProfile: 'x', signals: [] },
    }),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { machineRepository, machineConnectionRepository, unitOfWork };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new SimulatorMachineResolver(
    fakes.machineRepository,
    fakes.machineConnectionRepository,
    fakes.unitOfWork,
  );
}

describe('SimulatorMachineResolver', () => {
  it('resuelve la MachineConnection cuando la Machine existe y es Simulator', async () => {
    const fakes = createFakes();
    const resolver = createResolver(fakes);

    const connection = await resolver.resolve('machine-1');

    expect(connection.providerType).toBe(ProviderType.Simulator);
  });

  it('lanza MachineNotFoundError si la Machine no existe', async () => {
    const fakes = createFakes();
    fakes.machineRepository.findById.mockResolvedValue(null);
    const resolver = createResolver(fakes);

    await expect(resolver.resolve('missing')).rejects.toBeInstanceOf(MachineNotFoundError);
  });

  it('lanza NotASimulatedMachineError si el providerType no es Simulator', async () => {
    const fakes = createFakes();
    fakes.machineConnectionRepository.findByMachineId.mockResolvedValue({
      id: 'connection-1',
      machineId: 'machine-1',
      providerType: ProviderType.OpcUa,
      connectionConfig: {},
    });
    const resolver = createResolver(fakes);

    await expect(resolver.resolve('machine-1')).rejects.toBeInstanceOf(NotASimulatedMachineError);
  });

  it('lanza NotASimulatedMachineError si la Machine no tiene MachineConnection', async () => {
    const fakes = createFakes();
    fakes.machineConnectionRepository.findByMachineId.mockResolvedValue(null);
    const resolver = createResolver(fakes);

    await expect(resolver.resolve('machine-1')).rejects.toBeInstanceOf(NotASimulatedMachineError);
  });
});

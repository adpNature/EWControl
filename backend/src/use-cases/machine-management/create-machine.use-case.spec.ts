import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { CreateMachineUseCase } from './create-machine.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const machineRepository = {
    create: vi.fn().mockResolvedValue({ id: 'machine-1', companyId: 'company-1', name: 'Demo' }),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const machineConnectionRepository = {
    create: vi.fn().mockResolvedValue({
      id: 'connection-1',
      machineId: 'machine-1',
      providerType: ProviderType.Simulator,
      connectionConfig: { seedProfile: 'empty', signals: [] },
    }),
    findByMachineId: vi.fn(),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { machineRepository, machineConnectionRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateMachineUseCase(
    fakes.machineRepository,
    fakes.machineConnectionRepository,
    fakes.unitOfWork,
  );
}

describe('CreateMachineUseCase', () => {
  it('crea la Machine con el companyId del input y una MachineConnection Simulator por defecto', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({ companyId: 'company-1', name: 'Bobinadora 1' });

    expect(fakes.machineRepository.create).toHaveBeenCalledWith(
      { companyId: 'company-1', name: 'Bobinadora 1' },
      FAKE_CTX,
    );
    expect(fakes.machineConnectionRepository.create).toHaveBeenCalledWith(
      {
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: { seedProfile: 'empty', signals: [] },
      },
      FAKE_CTX,
    );
    expect(result.machine.id).toBe('machine-1');
    expect(result.connection.providerType).toBe(ProviderType.Simulator);
  });

  it('crea ambas entidades dentro de la misma transacción', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ companyId: 'company-1', name: 'Bobinadora 1' });

    expect(fakes.unitOfWork.runInTransaction).toHaveBeenCalledTimes(1);
  });
});

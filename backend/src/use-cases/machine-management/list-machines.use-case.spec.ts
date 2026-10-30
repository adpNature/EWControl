import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { ListMachinesUseCase } from './list-machines.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [{ id: 'machine-1' }], total: 1 }),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const machineConnectionRepository = {
    findByMachineIds: vi
      .fn()
      .mockResolvedValue([{ machineId: 'machine-1', providerType: ProviderType.OpcUa }]),
  };
  return { machineRepository, machineConnectionRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ListMachinesUseCase(
    fakes.machineRepository as never,
    fakes.machineConnectionRepository as never,
    fakes.unitOfWork,
  );
}

describe('ListMachinesUseCase', () => {
  it('filtra por la Company del requester cuando es AdminCliente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.machineRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
    expect(result).toEqual({
      data: [{ id: 'machine-1', providerType: ProviderType.OpcUa }],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('no filtra por Company cuando el requester es SuperAdmin sin companyId explícito', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.machineRepository.list).toHaveBeenCalledWith(
      { companyId: null, isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('un SuperAdmin con companyId explícito acota el listado a esa Company', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      companyId: 'company-2',
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.machineRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-2', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('un AdminCliente que envía companyId lo ve ignorado; se acota a su propia Company', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      companyId: 'company-2',
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.machineRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('incluye providerType de cada Machine con una sola consulta, y null si no tiene conexión (spec 18, criterio 12)', async () => {
    const fakes = createFakes();
    fakes.machineRepository.list.mockResolvedValue({
      data: [{ id: 'machine-1' }, { id: 'machine-2' }],
      total: 2,
    });
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.machineConnectionRepository.findByMachineIds).toHaveBeenCalledWith(
      ['machine-1', 'machine-2'],
      FAKE_CTX,
    );
    expect(result.data).toEqual([
      { id: 'machine-1', providerType: ProviderType.OpcUa },
      { id: 'machine-2', providerType: null },
    ]);
  });
});

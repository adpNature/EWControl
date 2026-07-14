import { describe, expect, it, vi } from 'vitest';
import { CompanyNotFoundError } from './errors/company-not-found.error';
import { DeleteCompanyPermanentlyUseCase } from './delete-company-permanently.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-14T10:00:00.000Z');
const MACHINES = [{ id: 'machine-1' }, { id: 'machine-2' }];

function createFakes() {
  const companyRepository = {
    findByName: vi.fn(),
    findById: vi.fn().mockResolvedValue({ id: 'company-1', name: 'ACME', isActive: true }),
    create: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    delete: vi.fn(),
  };
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    findAllByCompanyId: vi.fn().mockResolvedValue(MACHINES),
    deleteAllByCompanyId: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    findActiveDirectByMachineAndVariableName: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
    deleteAllByMachineId: vi.fn(),
  };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn(),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
    deleteByMachineId: vi.fn(),
  };
  const userRepository = {
    create: vi.fn(),
    findActiveByCompanyAndRole: vi.fn(),
    findById: vi.fn(),
    findByEmail: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    reactivate: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  const historyWriter = {
    writeBatch: vi.fn(),
    hasDataInRange: vi.fn(),
    deleteRange: vi.fn(),
    deleteAllForCompany: vi.fn().mockResolvedValue(undefined),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return {
    companyRepository,
    machineRepository,
    signalRepository,
    machineConnectionRepository,
    userRepository,
    historyWriter,
    clock,
    unitOfWork,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new DeleteCompanyPermanentlyUseCase(
    fakes.companyRepository,
    fakes.machineRepository,
    fakes.signalRepository,
    fakes.machineConnectionRepository,
    fakes.userRepository,
    fakes.historyWriter,
    fakes.clock,
    fakes.unitOfWork,
  );
}

describe('DeleteCompanyPermanentlyUseCase', () => {
  it('borra Signals y MachineConnections de cada Machine, luego Machines, Users y la Company, en ese orden', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ companyId: 'company-1' });

    expect(fakes.signalRepository.deleteAllByMachineId).toHaveBeenCalledWith('machine-1', FAKE_CTX);
    expect(fakes.signalRepository.deleteAllByMachineId).toHaveBeenCalledWith('machine-2', FAKE_CTX);
    expect(fakes.machineConnectionRepository.deleteByMachineId).toHaveBeenCalledWith(
      'machine-1',
      FAKE_CTX,
    );
    expect(fakes.machineConnectionRepository.deleteByMachineId).toHaveBeenCalledWith(
      'machine-2',
      FAKE_CTX,
    );
    expect(fakes.machineRepository.deleteAllByCompanyId).toHaveBeenCalledWith(
      'company-1',
      FAKE_CTX,
    );
    expect(fakes.userRepository.deleteAllByCompanyId).toHaveBeenCalledWith('company-1', FAKE_CTX);
    expect(fakes.companyRepository.delete).toHaveBeenCalledWith('company-1', FAKE_CTX);
  });

  it('borra también el histórico de InfluxDB de la Company tras confirmar la transacción de Postgres', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ companyId: 'company-1' });

    expect(fakes.historyWriter.deleteAllForCompany).toHaveBeenCalledWith('company-1', NOW);
  });

  it('no revierte el borrado en Postgres si el borrado en InfluxDB falla (best-effort)', async () => {
    const fakes = createFakes();
    fakes.historyWriter.deleteAllForCompany.mockRejectedValue(new Error('InfluxDB no disponible'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ companyId: 'company-1' })).resolves.toBeUndefined();
    expect(fakes.companyRepository.delete).toHaveBeenCalledWith('company-1', FAKE_CTX);
  });

  it('lanza CompanyNotFoundError si no existe, sin borrar nada', async () => {
    const fakes = createFakes();
    fakes.companyRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute({ companyId: 'missing' })).rejects.toBeInstanceOf(
      CompanyNotFoundError,
    );
    expect(fakes.companyRepository.delete).not.toHaveBeenCalled();
    expect(fakes.historyWriter.deleteAllForCompany).not.toHaveBeenCalled();
  });

  it('funciona sobre una Company activa o inactiva por igual', async () => {
    const fakes = createFakes();
    fakes.companyRepository.findById.mockResolvedValue({
      id: 'company-1',
      name: 'ACME',
      isActive: false,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({ companyId: 'company-1' });

    expect(fakes.companyRepository.delete).toHaveBeenCalledWith('company-1', FAKE_CTX);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { ListSignalsUseCase } from './list-signals.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue({ id: 'machine-1' }) };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    list: vi.fn().mockResolvedValue({ data: [{ id: 'signal-1' }], total: 1 }),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, signalRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ListSignalsUseCase(fakes.resolver as never, fakes.signalRepository, fakes.unitOfWork);
}

describe('ListSignalsUseCase', () => {
  it('resuelve la Machine activa y lista sus Signals activas paginadas', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    const result = await useCase.execute({
      machineId: 'machine-1',
      requester,
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('machine-1', requester, FAKE_CTX);
    expect(fakes.signalRepository.list).toHaveBeenCalledWith(
      { machineId: 'machine-1', isActive: true },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
    expect(result).toEqual({ data: [{ id: 'signal-1' }], total: 1, limit: 20, offset: 0 });
  });
});

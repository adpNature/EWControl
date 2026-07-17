import { describe, expect, it, vi } from 'vitest';
import { classifySignalIdsByCompany } from './classify-signal-ids-by-company';

const FAKE_CTX = Symbol('tx-ctx');
const COMPANY_ID = 'company-1';
const SIGNAL_1 = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const SIGNAL_2 = { id: 'signal-2', machineId: 'machine-2', isActive: true };
const MACHINE_1 = { id: 'machine-1', companyId: COMPANY_ID, isActive: true };
const MACHINE_2 = { id: 'machine-2', companyId: COMPANY_ID, isActive: true };

function createDeps() {
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    findActiveDirectByMachineAndVariableName: vi.fn(),
    findActiveFormulasByMachineAndVariableName: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
    deleteAllByMachineId: vi.fn(),
  };
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    findAllByCompanyId: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  return { signalRepository, machineRepository };
}

describe('classifySignalIdsByCompany', () => {
  it('clasifica como válidas las Signals activas cuya Machine pertenece a la Company', async () => {
    const deps = createDeps();
    deps.signalRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(id === SIGNAL_1.id ? SIGNAL_1 : SIGNAL_2),
    );
    deps.machineRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(id === MACHINE_1.id ? MACHINE_1 : MACHINE_2),
    );

    const result = await classifySignalIdsByCompany(
      [SIGNAL_1.id, SIGNAL_2.id],
      COMPANY_ID,
      deps,
      FAKE_CTX,
    );

    expect(result).toEqual({ valid: [SIGNAL_1, SIGNAL_2], invalid: [] });
  });

  it('reporta como inválida una Signal inexistente', async () => {
    const deps = createDeps();
    deps.signalRepository.findById.mockResolvedValue(null);

    const result = await classifySignalIdsByCompany(['signal-missing'], COMPANY_ID, deps, FAKE_CTX);

    expect(result).toEqual({ valid: [], invalid: ['signal-missing'] });
    expect(deps.machineRepository.findById).not.toHaveBeenCalled();
  });

  it('reporta como inválida una Signal inactiva', async () => {
    const deps = createDeps();
    deps.signalRepository.findById.mockResolvedValue({ ...SIGNAL_1, isActive: false });

    const result = await classifySignalIdsByCompany([SIGNAL_1.id], COMPANY_ID, deps, FAKE_CTX);

    expect(result).toEqual({ valid: [], invalid: [SIGNAL_1.id] });
  });

  it('reporta como inválida una Signal cuya Machine pertenece a otra Company', async () => {
    const deps = createDeps();
    deps.signalRepository.findById.mockResolvedValue(SIGNAL_1);
    deps.machineRepository.findById.mockResolvedValue({ ...MACHINE_1, companyId: 'other-company' });

    const result = await classifySignalIdsByCompany([SIGNAL_1.id], COMPANY_ID, deps, FAKE_CTX);

    expect(result).toEqual({ valid: [], invalid: [SIGNAL_1.id] });
  });

  it('reporta como inválida una Signal cuya Machine no existe', async () => {
    const deps = createDeps();
    deps.signalRepository.findById.mockResolvedValue(SIGNAL_1);
    deps.machineRepository.findById.mockResolvedValue(null);

    const result = await classifySignalIdsByCompany([SIGNAL_1.id], COMPANY_ID, deps, FAKE_CTX);

    expect(result).toEqual({ valid: [], invalid: [SIGNAL_1.id] });
  });
});

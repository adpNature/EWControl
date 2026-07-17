import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { CompanyIdRequiredError } from './errors/company-id-required.error';
import { InvalidHistoryRangeError } from './errors/invalid-history-range.error';
import { SignalNotFoundForHistoryError } from './errors/signal-not-found-for-history.error';
import { GetSignalsHistoryUseCase } from './get-signals-history.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const COMPANY_ID = 'company-1';
const SIGNAL_A = { id: 'signal-a', machineId: 'machine-1', isActive: true };
const SIGNAL_B = { id: 'signal-b', machineId: 'machine-2', isActive: true };
const MACHINE_1 = { id: 'machine-1', companyId: COMPANY_ID, isActive: true };
const MACHINE_2 = { id: 'machine-2', companyId: COMPANY_ID, isActive: true };
const FROM = new Date('2026-07-11T08:00:00Z');
const TO = new Date('2026-07-12T10:00:00Z');
const ADMIN_REQUESTER = { companyId: COMPANY_ID, role: UserRole.AdminCliente };
const SUPERADMIN_REQUESTER = { companyId: '', role: UserRole.SuperAdmin };

function createFakes() {
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
  signalRepository.findById.mockImplementation((id: string) =>
    Promise.resolve(id === SIGNAL_A.id ? SIGNAL_A : id === SIGNAL_B.id ? SIGNAL_B : null),
  );
  const machineRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    findAllByCompanyId: vi.fn(),
    deleteAllByCompanyId: vi.fn(),
  };
  machineRepository.findById.mockImplementation((id: string) =>
    Promise.resolve(id === MACHINE_1.id ? MACHINE_1 : id === MACHINE_2.id ? MACHINE_2 : null),
  );
  const historyReader = { queryRange: vi.fn(), queryRangeBatch: vi.fn().mockResolvedValue([]) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { signalRepository, machineRepository, historyReader, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetSignalsHistoryUseCase(
    fakes.signalRepository,
    fakes.machineRepository,
    fakes.historyReader,
    fakes.unitOfWork,
  );
}

describe('GetSignalsHistoryUseCase', () => {
  it('devuelve una serie por Signal, en el orden solicitado, agrupando los puntos por signalId', async () => {
    const fakes = createFakes();
    fakes.historyReader.queryRangeBatch.mockResolvedValue([
      { signalId: SIGNAL_A.id, timestamp: new Date('2026-07-12T09:00:00Z'), value: 1 },
      { signalId: SIGNAL_B.id, timestamp: new Date('2026-07-12T09:00:00Z'), value: 2 },
      { signalId: SIGNAL_A.id, timestamp: new Date('2026-07-12T09:30:00Z'), value: 3 },
    ]);
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalIds: [SIGNAL_A.id, SIGNAL_B.id],
      from: FROM,
      to: TO,
      requester: ADMIN_REQUESTER,
    });

    expect(result.resolution).toBe('minute');
    expect(result.series).toEqual([
      {
        signalId: SIGNAL_A.id,
        machineId: MACHINE_1.id,
        points: [
          { timestamp: new Date('2026-07-12T09:00:00Z'), value: 1 },
          { timestamp: new Date('2026-07-12T09:30:00Z'), value: 3 },
        ],
      },
      {
        signalId: SIGNAL_B.id,
        machineId: MACHINE_2.id,
        points: [{ timestamp: new Date('2026-07-12T09:00:00Z'), value: 2 }],
      },
    ]);
    expect(fakes.historyReader.queryRangeBatch).toHaveBeenCalledWith({
      signalIds: [SIGNAL_A.id, SIGNAL_B.id],
      from: FROM,
      to: TO,
      resolution: 'minute',
    });
  });

  it('respeta la resolución explícita sin inferirla', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalIds: [SIGNAL_A.id],
      from: FROM,
      to: TO,
      resolution: 'raw',
      requester: ADMIN_REQUESTER,
    });

    expect(result.resolution).toBe('raw');
  });

  it('deduplica signalIds repetidos y devuelve una sola serie por id', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalIds: [SIGNAL_A.id, SIGNAL_A.id],
      from: FROM,
      to: TO,
      requester: ADMIN_REQUESTER,
    });

    expect(result.series).toHaveLength(1);
    expect(fakes.historyReader.queryRangeBatch).toHaveBeenCalledWith(
      expect.objectContaining({ signalIds: [SIGNAL_A.id] }),
    );
  });

  it('una Signal sin puntos en el rango devuelve points: [] en su propia entrada', async () => {
    const fakes = createFakes();
    fakes.historyReader.queryRangeBatch.mockResolvedValue([]);
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalIds: [SIGNAL_A.id],
      from: FROM,
      to: TO,
      requester: ADMIN_REQUESTER,
    });

    expect(result.series).toEqual([{ signalId: SIGNAL_A.id, machineId: MACHINE_1.id, points: [] }]);
  });

  it('lanza InvalidHistoryRangeError si from >= to, sin clasificar ni consultar nada', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        signalIds: [SIGNAL_A.id],
        from: TO,
        to: FROM,
        requester: ADMIN_REQUESTER,
      }),
    ).rejects.toBeInstanceOf(InvalidHistoryRangeError);
    expect(fakes.signalRepository.findById).not.toHaveBeenCalled();
    expect(fakes.historyReader.queryRangeBatch).not.toHaveBeenCalled();
  });

  it('un AdminCliente que envía companyId lo ve ignorado; se acota a su propia Company', async () => {
    const fakes = createFakes();
    fakes.machineRepository.findById.mockResolvedValue({
      ...MACHINE_1,
      companyId: 'other-company',
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        signalIds: [SIGNAL_A.id],
        from: FROM,
        to: TO,
        companyId: 'other-company',
        requester: ADMIN_REQUESTER,
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundForHistoryError);
  });

  it('lanza CompanyIdRequiredError si el requester es SuperAdmin sin companyId', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        signalIds: [SIGNAL_A.id],
        from: FROM,
        to: TO,
        requester: SUPERADMIN_REQUESTER,
      }),
    ).rejects.toBeInstanceOf(CompanyIdRequiredError);
    expect(fakes.historyReader.queryRangeBatch).not.toHaveBeenCalled();
  });

  it('un SuperAdmin con companyId explícito queda acotado exactamente a esa Company', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalIds: [SIGNAL_A.id, SIGNAL_B.id],
      from: FROM,
      to: TO,
      companyId: COMPANY_ID,
      requester: SUPERADMIN_REQUESTER,
    });

    expect(result.series).toHaveLength(2);
  });

  it('lanza SignalNotFoundForHistoryError listando todos los ids inválidos, sin distinguir el motivo', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        signalIds: [SIGNAL_A.id, 'signal-missing'],
        from: FROM,
        to: TO,
        requester: ADMIN_REQUESTER,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(SignalNotFoundForHistoryError);
      expect((error as SignalNotFoundForHistoryError).signalIds).toEqual(['signal-missing']);
      return true;
    });
    expect(fakes.historyReader.queryRangeBatch).not.toHaveBeenCalled();
  });
});

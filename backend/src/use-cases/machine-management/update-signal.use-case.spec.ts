import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { SignalType } from '../../entities/signal-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { FormulaExpressionInvalidError } from './errors/formula-expression-invalid.error';
import { FormulaReferencesUnknownVariableError } from './errors/formula-references-unknown-variable.error';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { UpdateSignalUseCase } from './update-signal.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const CONNECTION = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: ProviderType.Simulator,
  connectionConfig: {
    seedProfile: 'demo',
    signals: [{ variableName: 'temperature', min: 0, max: 100, stepMax: 1 }],
  },
};
const DIRECT_SIGNAL = {
  id: 'signal-1',
  machineId: 'machine-1',
  signalType: SignalType.DIRECT,
  signalSource: { variableName: 'temperature' },
};
const FORMULA_SIGNAL = {
  id: 'signal-2',
  machineId: 'machine-1',
  signalType: SignalType.FORMULA,
  signalSource: { expression: 'temperature', variables: ['temperature'] },
};

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn().mockResolvedValue(CONNECTION),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(DIRECT_SIGNAL),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn().mockImplementation((id, changes) => Promise.resolve({ id, ...changes })),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const eventPublisher = { publish: vi.fn() };
  return { resolver, machineConnectionRepository, signalRepository, unitOfWork, eventPublisher };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new UpdateSignalUseCase(
    fakes.resolver as never,
    fakes.machineConnectionRepository,
    fakes.signalRepository,
    fakes.unitOfWork,
    fakes.eventPublisher,
  );
}

describe('UpdateSignalUseCase', () => {
  it('actualiza una Signal DIRECT sin revalidar contra la MachineConnection', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: REQUESTER,
      changes: { name: 'Nuevo nombre' },
    });

    expect(fakes.machineConnectionRepository.findByMachineId).not.toHaveBeenCalled();
    expect(fakes.signalRepository.update).toHaveBeenCalledWith(
      'signal-1',
      { name: 'Nuevo nombre' },
      FAKE_CTX,
    );
  });

  it('revalida FORMULA cuando la Signal persistida es FORMULA y cambia signalSource', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(FORMULA_SIGNAL);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-2',
      requester: REQUESTER,
      changes: { signalSource: { expression: 'temperature', variables: ['temperature'] } },
    });

    expect(fakes.machineConnectionRepository.findByMachineId).toHaveBeenCalledWith(
      'machine-1',
      FAKE_CTX,
    );
    expect(fakes.signalRepository.update).toHaveBeenCalled();
  });

  it('lanza FormulaReferencesUnknownVariableError si la nueva fórmula referencia una variable desconocida', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(FORMULA_SIGNAL);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-2',
        requester: REQUESTER,
        changes: { signalSource: { expression: 'unknownVar', variables: ['unknownVar'] } },
      }),
    ).rejects.toBeInstanceOf(FormulaReferencesUnknownVariableError);
    expect(fakes.signalRepository.update).not.toHaveBeenCalled();
  });

  it('lanza FormulaExpressionInvalidError si la nueva expresión no es sintácticamente válida', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(FORMULA_SIGNAL);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-2',
        requester: REQUESTER,
        changes: { signalSource: { expression: 'temperature +', variables: ['temperature'] } },
      }),
    ).rejects.toBeInstanceOf(FormulaExpressionInvalidError);
    expect(fakes.signalRepository.update).not.toHaveBeenCalled();
  });

  it('lanza SignalNotFoundError si la Signal no pertenece a la Machine', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({ ...DIRECT_SIGNAL, machineId: 'other' });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        requester: REQUESTER,
        changes: { name: 'x' },
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
  });

  it('lanza MachineInactiveError si la Machine está desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        requester: REQUESTER,
        changes: { name: 'x' },
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.signalRepository.update).not.toHaveBeenCalled();
  });

  it('publica MachineSignalsChanged tras actualizar la Signal (spec 18)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: REQUESTER,
      changes: { signalSource: { variableName: 'pressure' } },
    });

    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineSignalsChanged', {
      machineId: 'machine-1',
      companyId: 'company-1',
    });
  });
});

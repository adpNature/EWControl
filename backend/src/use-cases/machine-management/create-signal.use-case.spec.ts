import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { SignalType } from '../../entities/signal-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { FormulaExpressionInvalidError } from './errors/formula-expression-invalid.error';
import { FormulaReferencesUnknownVariableError } from './errors/formula-references-unknown-variable.error';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { CreateSignalUseCase } from './create-signal.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const CONNECTION = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: ProviderType.Simulator,
  connectionConfig: {
    seedProfile: 'demo',
    signals: [
      { variableName: 'temperature', min: 0, max: 100, stepMax: 1 },
      { variableName: 'pressure', min: 0, max: 10, stepMax: 0.1 },
    ],
  },
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
    create: vi.fn().mockResolvedValue({ id: 'signal-1', machineId: 'machine-1' }),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, machineConnectionRepository, signalRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateSignalUseCase(
    fakes.resolver as never,
    fakes.machineConnectionRepository,
    fakes.signalRepository,
    fakes.unitOfWork,
  );
}

describe('CreateSignalUseCase', () => {
  it('crea una Signal DIRECT sin consultar la MachineConnection', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      name: 'Temperatura',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'temperature' },
      unit: '°C',
    });

    expect(fakes.machineConnectionRepository.findByMachineId).not.toHaveBeenCalled();
    expect(fakes.signalRepository.create).toHaveBeenCalledWith(
      {
        machineId: 'machine-1',
        name: 'Temperatura',
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'temperature' },
        unit: '°C',
        historyEnabled: false,
      },
      FAKE_CTX,
    );
  });

  it('crea una Signal FORMULA cuando todas sus variables existen en la MachineConnection', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      name: 'Diferencial',
      signalType: SignalType.FORMULA,
      signalSource: {
        expression: 'temperature - pressure',
        variables: ['temperature', 'pressure'],
      },
      unit: 'u',
    });

    expect(fakes.signalRepository.create).toHaveBeenCalled();
  });

  it('lanza FormulaReferencesUnknownVariableError si una variable no existe en la Machine', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'Diferencial',
        signalType: SignalType.FORMULA,
        signalSource: {
          expression: 'temperature - unknownVar',
          variables: ['temperature', 'unknownVar'],
        },
        unit: 'u',
      }),
    ).rejects.toBeInstanceOf(FormulaReferencesUnknownVariableError);
    expect(fakes.signalRepository.create).not.toHaveBeenCalled();
  });

  it('lanza FormulaExpressionInvalidError si la expresión no es sintácticamente válida', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'Diferencial',
        signalType: SignalType.FORMULA,
        signalSource: {
          expression: '(temperature - pressure',
          variables: ['temperature', 'pressure'],
        },
        unit: 'u',
      }),
    ).rejects.toBeInstanceOf(FormulaExpressionInvalidError);
    expect(fakes.signalRepository.create).not.toHaveBeenCalled();
  });

  it('lanza FormulaExpressionInvalidError si la expresión usa una variable no declarada en "variables" (aunque exista en la Machine)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'Diferencial',
        signalType: SignalType.FORMULA,
        signalSource: {
          expression: 'temperature - pressure',
          variables: ['temperature'],
        },
        unit: 'u',
      }),
    ).rejects.toBeInstanceOf(FormulaExpressionInvalidError);
    expect(fakes.signalRepository.create).not.toHaveBeenCalled();
  });

  it('lanza MachineInactiveError si la Machine está desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'Temperatura',
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'temperature' },
        unit: '°C',
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.signalRepository.create).not.toHaveBeenCalled();
  });
});

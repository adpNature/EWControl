import { describe, expect, it, vi } from 'vitest';
import { ForcedSignalQuality } from '../../entities/forced-signal-quality.enum';
import { NotASimulatedMachineError } from './errors/not-a-simulated-machine.error';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { ForceSignalQualityUseCase } from './force-signal-quality.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const resolver = { resolve: vi.fn().mockResolvedValue({}) };
  const simulatorRuntime = {
    isConnected: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    forceSignalQuality: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: 'signal-1',
      machineId: 'machine-1',
      signalSource: { variableName: 'MotorTemperature' },
    }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, simulatorRuntime, signalRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ForceSignalQualityUseCase(
    fakes.resolver as never,
    fakes.simulatorRuntime,
    fakes.signalRepository,
    fakes.unitOfWork,
  );
}

describe('ForceSignalQualityUseCase', () => {
  it('resuelve signalId a variableName y degrada la calidad en el runtime', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      signalId: 'signal-1',
      quality: ForcedSignalQuality.Bad,
      durationTicks: 10,
    });

    expect(fakes.simulatorRuntime.forceSignalQuality).toHaveBeenCalledWith(
      'machine-1',
      'MotorTemperature',
      ForcedSignalQuality.Bad,
      10,
    );
  });

  it('lanza SignalNotFoundError si el signal no existe', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'missing',
        quality: ForcedSignalQuality.Bad,
        durationTicks: 10,
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
    expect(fakes.simulatorRuntime.forceSignalQuality).not.toHaveBeenCalled();
  });

  it('lanza SignalNotFoundError si el signal pertenece a otra Machine', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findById.mockResolvedValue({
      id: 'signal-1',
      machineId: 'other-machine',
      signalSource: { variableName: 'MotorTemperature' },
    });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        quality: ForcedSignalQuality.Bad,
        durationTicks: 10,
      }),
    ).rejects.toBeInstanceOf(SignalNotFoundError);
    expect(fakes.simulatorRuntime.forceSignalQuality).not.toHaveBeenCalled();
  });

  it('propaga el error si la Machine no existe o no es Simulator', async () => {
    const fakes = createFakes();
    fakes.resolver.resolve.mockRejectedValue(new NotASimulatedMachineError('machine-1'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        signalId: 'signal-1',
        quality: ForcedSignalQuality.Bad,
        durationTicks: 10,
      }),
    ).rejects.toBeInstanceOf(NotASimulatedMachineError);
  });
});

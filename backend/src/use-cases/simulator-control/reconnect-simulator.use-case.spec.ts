import { describe, expect, it, vi } from 'vitest';
import { NotASimulatedMachineError } from './errors/not-a-simulated-machine.error';
import { ReconnectSimulatorUseCase } from './reconnect-simulator.use-case';

function createFakes() {
  const resolver = { resolve: vi.fn().mockResolvedValue({}) };
  const simulatorRuntime = {
    isConnected: vi.fn().mockReturnValue(false),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    forceSignalQuality: vi.fn(),
  };
  const eventPublisher = { publish: vi.fn() };
  return { resolver, simulatorRuntime, eventPublisher };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ReconnectSimulatorUseCase(
    fakes.resolver as never,
    fakes.simulatorRuntime,
    fakes.eventPublisher,
  );
}

describe('ReconnectSimulatorUseCase', () => {
  it('reconecta el simulador y publica MachineConnected cuando estaba desconectado', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute('machine-1');

    expect(fakes.simulatorRuntime.connect).toHaveBeenCalledWith('machine-1');
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith(
      'MachineConnected',
      expect.objectContaining({ machineId: 'machine-1' }),
    );
  });

  it('es idempotente: no vuelve a conectar ni a publicar si ya estaba conectado', async () => {
    const fakes = createFakes();
    fakes.simulatorRuntime.isConnected.mockReturnValue(true);
    const useCase = createUseCase(fakes);

    await useCase.execute('machine-1');

    expect(fakes.simulatorRuntime.connect).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('propaga el error si la Machine no existe o no es Simulator', async () => {
    const fakes = createFakes();
    fakes.resolver.resolve.mockRejectedValue(new NotASimulatedMachineError('machine-1'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute('machine-1')).rejects.toBeInstanceOf(NotASimulatedMachineError);
    expect(fakes.simulatorRuntime.connect).not.toHaveBeenCalled();
  });
});

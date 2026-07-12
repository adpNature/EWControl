import { describe, expect, it, vi } from 'vitest';
import { NotASimulatedMachineError } from './errors/not-a-simulated-machine.error';
import { ForceDisconnectSimulatorUseCase } from './force-disconnect-simulator.use-case';

function createFakes() {
  const resolver = {
    resolve: vi.fn().mockResolvedValue({ machine: { id: 'machine-1', companyId: 'company-1' } }),
  };
  const simulatorRuntime = {
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    forceSignalQuality: vi.fn(),
  };
  const eventPublisher = { publish: vi.fn() };
  return { resolver, simulatorRuntime, eventPublisher };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ForceDisconnectSimulatorUseCase(
    fakes.resolver as never,
    fakes.simulatorRuntime,
    fakes.eventPublisher,
  );
}

describe('ForceDisconnectSimulatorUseCase', () => {
  it('desconecta el simulador y publica MachineDisconnected cuando estaba conectado', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute('machine-1');

    expect(fakes.simulatorRuntime.disconnect).toHaveBeenCalledWith('machine-1');
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith(
      'MachineDisconnected',
      expect.objectContaining({ machineId: 'machine-1', companyId: 'company-1' }),
    );
  });

  it('es idempotente: no vuelve a desconectar ni a publicar si ya estaba desconectado', async () => {
    const fakes = createFakes();
    fakes.simulatorRuntime.isConnected.mockReturnValue(false);
    const useCase = createUseCase(fakes);

    await useCase.execute('machine-1');

    expect(fakes.simulatorRuntime.disconnect).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('propaga el error si la Machine no existe o no es Simulator', async () => {
    const fakes = createFakes();
    fakes.resolver.resolve.mockRejectedValue(new NotASimulatedMachineError('machine-1'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute('machine-1')).rejects.toBeInstanceOf(NotASimulatedMachineError);
    expect(fakes.simulatorRuntime.disconnect).not.toHaveBeenCalled();
  });
});

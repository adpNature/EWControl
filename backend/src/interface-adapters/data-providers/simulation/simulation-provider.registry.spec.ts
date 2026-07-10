import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionConfig } from '../../../entities/connection-config.vo';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';
import { ProviderType } from '../../../entities/provider-type.enum';
import { DataQuality } from '../data-quality.enum';
import { SimulationProviderRegistry } from './simulation-provider.registry';
import { SimulationProvider } from './simulation-provider';

const CONFIG: ConnectionConfig = {
  seedProfile: 'test-profile',
  signals: [{ variableName: 'WindingSpeed', min: 0, max: 1200, stepMax: 15 }],
};

function createFakes(
  connections: Array<{ machineId: string; connectionConfig: ConnectionConfig }>,
) {
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn(),
    findAllByProviderType: vi.fn().mockResolvedValue(
      connections.map((c) => ({
        id: `connection-${c.machineId}`,
        machineId: c.machineId,
        providerType: ProviderType.Simulator,
        connectionConfig: c.connectionConfig,
      })),
    ),
    replace: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(Symbol('ctx'))),
  };
  return { machineConnectionRepository, unitOfWork };
}

describe('SimulationProviderRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registra un SimulationProvider conectado por cada MachineConnection Simulator', async () => {
    const fakes = createFakes([
      { machineId: 'machine-1', connectionConfig: CONFIG },
      { machineId: 'machine-2', connectionConfig: CONFIG },
    ]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );

    await registry.onModuleInit();

    expect(registry.isConnected('machine-1')).toBe(true);
    expect(registry.isConnected('machine-2')).toBe(true);
    expect(fakes.machineConnectionRepository.findAllByProviderType).toHaveBeenCalledWith(
      ProviderType.Simulator,
      expect.anything(),
    );
  });

  it('no registra nada si no hay MachineConnections Simulator', async () => {
    const fakes = createFakes([]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );

    await registry.onModuleInit();

    expect(() => registry.isConnected('machine-1')).toThrow();
  });

  it('forceSignalQuality delega en el provider correcto con la calidad mapeada', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );
    await registry.onModuleInit();
    const spy = vi.spyOn(SimulationProvider.prototype, 'forceQuality');

    registry.forceSignalQuality('machine-1', 'WindingSpeed', ForcedSignalQuality.Bad, 10);

    expect(spy).toHaveBeenCalledWith('WindingSpeed', DataQuality.Bad, 10);
    spy.mockRestore();
  });

  it('connect/disconnect delegan en el provider correcto', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );
    await registry.onModuleInit();

    await registry.disconnect('machine-1');
    expect(registry.isConnected('machine-1')).toBe(false);

    await registry.connect('machine-1');
    expect(registry.isConnected('machine-1')).toBe(true);
  });

  it('forceSignalQuality mapea ForcedSignalQuality.Uncertain a DataQuality.Uncertain', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );
    await registry.onModuleInit();
    const spy = vi.spyOn(SimulationProvider.prototype, 'forceQuality');

    registry.forceSignalQuality('machine-1', 'WindingSpeed', ForcedSignalQuality.Uncertain, 5);

    expect(spy).toHaveBeenCalledWith('WindingSpeed', DataQuality.Uncertain, 5);
    spy.mockRestore();
  });

  it('lanza si se pide un machineId sin provider registrado', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = new SimulationProviderRegistry(
      fakes.machineConnectionRepository,
      fakes.unitOfWork,
    );
    await registry.onModuleInit();

    expect(() => registry.isConnected('unknown-machine')).toThrow();
  });
});

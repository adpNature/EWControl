import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SimulatorConnectionConfig as ConnectionConfig } from '../../../entities/connection-config.vo';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';
import { ProviderType } from '../../../entities/provider-type.enum';
import { SignalQuality } from '../../../entities/signal-quality.enum';
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
    findByMachineId: vi.fn().mockResolvedValue(null),
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
  const ingestSignalTick = { execute: vi.fn().mockResolvedValue(undefined) };
  const metrics = { setDataProviderConnected: vi.fn() };
  return { machineConnectionRepository, unitOfWork, ingestSignalTick, metrics };
}

function createRegistry(fakes: ReturnType<typeof createFakes>) {
  return new SimulationProviderRegistry(
    fakes.machineConnectionRepository,
    fakes.unitOfWork,
    fakes.ingestSignalTick as never,
    fakes.metrics as never,
  );
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
    const registry = createRegistry(fakes);

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
    const registry = createRegistry(fakes);

    await registry.onModuleInit();

    expect(() => registry.isConnected('machine-1')).toThrow();
  });

  it('forceSignalQuality delega en el provider correcto con la calidad mapeada', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const spy = vi.spyOn(SimulationProvider.prototype, 'forceQuality');

    registry.forceSignalQuality('machine-1', 'WindingSpeed', ForcedSignalQuality.Bad, 10);

    expect(spy).toHaveBeenCalledWith('WindingSpeed', DataQuality.Bad, 10);
    spy.mockRestore();
  });

  it('connect/disconnect delegan en el provider correcto', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    await registry.disconnect('machine-1');
    expect(registry.isConnected('machine-1')).toBe(false);

    await registry.connect('machine-1');
    expect(registry.isConnected('machine-1')).toBe(true);
  });

  it('actualiza ewcontrol_data_provider_connected en onModuleInit/connect/disconnect (spec 15)', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);

    await registry.onModuleInit();
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenCalledWith('machine-1', true);

    await registry.disconnect('machine-1');
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenCalledWith('machine-1', false);

    await registry.connect('machine-1');
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenLastCalledWith('machine-1', true);
  });

  it('forceSignalQuality mapea ForcedSignalQuality.Uncertain a DataQuality.Uncertain', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const spy = vi.spyOn(SimulationProvider.prototype, 'forceQuality');

    registry.forceSignalQuality('machine-1', 'WindingSpeed', ForcedSignalQuality.Uncertain, 5);

    expect(spy).toHaveBeenCalledWith('WindingSpeed', DataQuality.Uncertain, 5);
    spy.mockRestore();
  });

  it('lanza si se pide un machineId sin provider registrado', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    expect(() => registry.isConnected('unknown-machine')).toThrow();
  });

  it('se suscribe a cada provider y reenvía sus ticks a IngestSignalTickUseCase (docs/specs/07)', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    expect(fakes.ingestSignalTick.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        machineId: 'machine-1',
        variableName: 'WindingSpeed',
        quality: SignalQuality.Good,
      }),
    );
  });

  it('reenvía el correlationId de la Variable del Data Provider a IngestSignalTickUseCase (spec 15)', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    vi.advanceTimersByTime(1000);
    await Promise.resolve();

    const [input] = fakes.ingestSignalTick.execute.mock.calls[0] as [{ correlationId: string }];
    expect(typeof input.correlationId).toBe('string');
    expect(input.correlationId.length).toBeGreaterThan(0);
  });

  it('un fallo de IngestSignalTickUseCase no detiene el intervalo del provider', async () => {
    const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
    fakes.ingestSignalTick.execute.mockRejectedValue(new Error('boom'));
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    await Promise.resolve();

    expect(registry.isConnected('machine-1')).toBe(true);
  });

  describe('MachineConnectionReplaced (spec 18, criterio backend 2)', () => {
    it('detiene el provider de una Machine que deja de ser Simulator', async () => {
      const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
      const registry = createRegistry(fakes);
      await registry.onModuleInit();

      await registry.onMachineConnectionReplaced({
        machineId: 'machine-1',
        companyId: 'company-1',
        previousProviderType: ProviderType.Simulator,
        providerType: ProviderType.OpcUa,
      });

      expect(() => registry.isConnected('machine-1')).toThrow();
      expect(fakes.metrics.setDataProviderConnected).toHaveBeenLastCalledWith('machine-1', false);
      expect(fakes.machineConnectionRepository.findByMachineId).not.toHaveBeenCalled();

      fakes.ingestSignalTick.execute.mockClear();
      vi.advanceTimersByTime(3000);
      expect(fakes.ingestSignalTick.execute).not.toHaveBeenCalled();
    });

    it('arranca un provider para una Machine que pasa a ser Simulator', async () => {
      const fakes = createFakes([]);
      fakes.machineConnectionRepository.findByMachineId.mockResolvedValue({
        id: 'connection-1',
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: CONFIG,
      });
      const registry = createRegistry(fakes);
      await registry.onModuleInit();

      await registry.onMachineConnectionReplaced({
        machineId: 'machine-1',
        companyId: 'company-1',
        previousProviderType: ProviderType.OpcUa,
        providerType: ProviderType.Simulator,
      });

      expect(registry.isConnected('machine-1')).toBe(true);
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(fakes.ingestSignalTick.execute).toHaveBeenCalledWith(
        expect.objectContaining({ machineId: 'machine-1', variableName: 'WindingSpeed' }),
      );
    });

    it('reinicia el provider con la config nueva si sigue siendo Simulator', async () => {
      const newConfig: ConnectionConfig = {
        seedProfile: 'test-profile',
        signals: [{ variableName: 'Tension', min: 0, max: 10, stepMax: 1 }],
      };
      const fakes = createFakes([{ machineId: 'machine-1', connectionConfig: CONFIG }]);
      fakes.machineConnectionRepository.findByMachineId.mockResolvedValue({
        id: 'connection-1',
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: newConfig,
      });
      const registry = createRegistry(fakes);
      await registry.onModuleInit();

      await registry.onMachineConnectionReplaced({
        machineId: 'machine-1',
        companyId: 'company-1',
        previousProviderType: ProviderType.Simulator,
        providerType: ProviderType.Simulator,
      });
      fakes.ingestSignalTick.execute.mockClear();
      vi.advanceTimersByTime(1000);
      await Promise.resolve();

      const variableNames = fakes.ingestSignalTick.execute.mock.calls.map(
        ([input]) => (input as { variableName: string }).variableName,
      );
      expect(variableNames).toEqual(['Tension']);
    });

    it('ignora cambios entre proveedores que no son Simulator', async () => {
      const fakes = createFakes([]);
      const registry = createRegistry(fakes);
      await registry.onModuleInit();

      await registry.onMachineConnectionReplaced({
        machineId: 'machine-1',
        companyId: 'company-1',
        previousProviderType: ProviderType.OpcUa,
        providerType: ProviderType.OpcUa,
      });

      expect(fakes.machineConnectionRepository.findByMachineId).not.toHaveBeenCalled();
      expect(() => registry.isConnected('machine-1')).toThrow();
    });

    it('un fallo al cargar la conexión nueva no se propaga al emisor del evento', async () => {
      const fakes = createFakes([]);
      fakes.machineConnectionRepository.findByMachineId.mockRejectedValue(new Error('db down'));
      const registry = createRegistry(fakes);
      await registry.onModuleInit();

      await expect(
        registry.onMachineConnectionReplaced({
          machineId: 'machine-1',
          companyId: 'company-1',
          previousProviderType: null,
          providerType: ProviderType.Simulator,
        }),
      ).resolves.toBeUndefined();
    });
  });
});

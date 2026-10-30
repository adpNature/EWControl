import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';
import { ProviderType } from '../../../entities/provider-type.enum';
import { SignalQuality } from '../../../entities/signal-quality.enum';
import type { IOpcUaDriver, IOpcUaDriverListener } from './opc-ua-driver.port';
import { OpcUaProviderRegistry } from './opc-ua-provider.registry';

const NOW = new Date('2026-10-30T12:00:00Z');
const NODE = 'ns=3;s="Lectura"."REAL_1"';
const CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [{ nodeId: NODE, signalVariableName: 'Lectura_REAL_1' }],
};

class FakeDriver implements IOpcUaDriver {
  listener: IOpcUaDriverListener | undefined;
  start = vi.fn((listener: IOpcUaDriverListener) => {
    this.listener = listener;
  });
  stop = vi.fn(() => Promise.resolve());
}

type MachineRow = { id: string; companyId: string; isActive: boolean };
type ConnectionRow = {
  machineId: string;
  providerType: ProviderType;
  connectionConfig: OpcUaConnectionConfig;
};

function createFakes(options: { machines?: MachineRow[]; connections?: ConnectionRow[] } = {}) {
  const machines = new Map(
    (options.machines ?? [{ id: 'machine-1', companyId: 'company-1', isActive: true }]).map((m) => [
      m.id,
      m,
    ]),
  );
  const connections = new Map(
    (
      options.connections ?? [
        { machineId: 'machine-1', providerType: ProviderType.OpcUa, connectionConfig: CONFIG },
      ]
    ).map((c) => [c.machineId, c]),
  );
  const machineConnectionRepository = {
    findAllByProviderType: vi.fn((providerType: ProviderType) =>
      Promise.resolve([...connections.values()].filter((c) => c.providerType === providerType)),
    ),
    findByMachineId: vi.fn((machineId: string) =>
      Promise.resolve(connections.get(machineId) ?? null),
    ),
  };
  const machineRepository = {
    findById: vi.fn((machineId: string) => Promise.resolve(machines.get(machineId) ?? null)),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(Symbol('ctx'))),
  };
  const ingestSignalTick = { execute: vi.fn().mockResolvedValue(undefined) };
  const eventPublisher = { publish: vi.fn() };
  const metrics = {
    setDataProviderConnected: vi.fn(),
    incrementDataProviderReconnect: vi.fn(),
  };
  const drivers: FakeDriver[] = [];
  const driverFactory = vi.fn(() => {
    const driver = new FakeDriver();
    drivers.push(driver);
    return driver;
  });
  const clock = { now: () => NOW };
  return {
    connections,
    machineConnectionRepository,
    machineRepository,
    unitOfWork,
    ingestSignalTick,
    eventPublisher,
    metrics,
    drivers,
    driverFactory,
    clock,
  };
}

function createRegistry(fakes: ReturnType<typeof createFakes>) {
  return new OpcUaProviderRegistry(
    fakes.machineConnectionRepository as never,
    fakes.machineRepository as never,
    fakes.unitOfWork,
    fakes.ingestSignalTick as never,
    fakes.eventPublisher,
    fakes.metrics as never,
    fakes.driverFactory,
    fakes.clock,
  );
}

describe('OpcUaProviderRegistry', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('arranca un provider por cada Machine OpcUa activa sin esperar a que conecte (criterio 9)', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);

    await registry.onModuleInit();

    expect(fakes.driverFactory).toHaveBeenCalledWith(CONFIG);
    expect(fakes.drivers[0].start).toHaveBeenCalledTimes(1);
    expect(registry.hasProvider('machine-1')).toBe(true);
    expect(registry.isConnected('machine-1')).toBe(false);
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenCalledWith('machine-1', false);
  });

  it('no arranca providers para Machines inactivas', async () => {
    const fakes = createFakes({
      machines: [{ id: 'machine-1', companyId: 'company-1', isActive: false }],
    });
    const registry = createRegistry(fakes);

    await registry.onModuleInit();

    expect(fakes.driverFactory).not.toHaveBeenCalled();
    expect(registry.hasProvider('machine-1')).toBe(false);
  });

  it('publica MachineConnected y pone la métrica a 1 al conectar (criterio 8)', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    fakes.drivers[0].listener!.onConnected();

    expect(registry.isConnected('machine-1')).toBe(true);
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenLastCalledWith('machine-1', true);
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineConnected', {
      machineId: 'machine-1',
      companyId: 'company-1',
      timestamp: NOW,
    });
    expect(fakes.metrics.incrementDataProviderReconnect).not.toHaveBeenCalled();
  });

  it('al perder la conexión publica MachineDisconnected y al recuperarla cuenta una reconexión (criterio 8)', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const listener = fakes.drivers[0].listener!;

    listener.onConnected();
    listener.onDisconnected();

    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineDisconnected', {
      machineId: 'machine-1',
      companyId: 'company-1',
      timestamp: NOW,
    });
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenLastCalledWith('machine-1', false);

    listener.onConnected();

    expect(fakes.metrics.incrementDataProviderReconnect).toHaveBeenCalledWith('machine-1');
    expect(fakes.eventPublisher.publish).toHaveBeenLastCalledWith(
      'MachineConnected',
      expect.objectContaining({ machineId: 'machine-1' }),
    );
  });

  it('reenvía las Variables del provider a IngestSignalTickUseCase', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const listener = fakes.drivers[0].listener!;
    listener.onConnected();

    listener.onDataChange({
      nodeId: NODE,
      value: 4.5,
      builtInType: 'Float',
      isArray: false,
      severity: 'Good',
      statusCodeName: 'Good',
    });

    expect(fakes.ingestSignalTick.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      variableName: 'Lectura_REAL_1',
      value: 4.5,
      quality: SignalQuality.Good,
      timestamp: NOW,
      correlationId: expect.any(String),
    });
  });

  it('Simulator → OpcUa arranca el provider en caliente (criterio 2)', async () => {
    const fakes = createFakes({ connections: [] });
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    fakes.connections.set('machine-1', {
      machineId: 'machine-1',
      providerType: ProviderType.OpcUa,
      connectionConfig: CONFIG,
    });

    await registry.onMachineConnectionReplaced({
      machineId: 'machine-1',
      companyId: 'company-1',
      previousProviderType: ProviderType.Simulator,
      providerType: ProviderType.OpcUa,
    });

    expect(registry.hasProvider('machine-1')).toBe(true);
    expect(fakes.drivers).toHaveLength(1);
  });

  it('OpcUa → OpcUa detiene el driver anterior y arranca uno nuevo con la config nueva', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const newConfig = { ...CONFIG, endpointUrl: 'opc.tcp://192.168.1.2:4840' };
    fakes.connections.set('machine-1', {
      machineId: 'machine-1',
      providerType: ProviderType.OpcUa,
      connectionConfig: newConfig,
    });

    await registry.onMachineConnectionReplaced({
      machineId: 'machine-1',
      companyId: 'company-1',
      previousProviderType: ProviderType.OpcUa,
      providerType: ProviderType.OpcUa,
    });

    expect(fakes.drivers[0].stop).toHaveBeenCalledTimes(1);
    expect(fakes.driverFactory).toHaveBeenLastCalledWith(newConfig);
    expect(fakes.drivers[1].start).toHaveBeenCalledTimes(1);
  });

  it('OpcUa → Simulator detiene el provider y deja la métrica a 0', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    fakes.drivers[0].listener!.onConnected();

    await registry.onMachineConnectionReplaced({
      machineId: 'machine-1',
      companyId: 'company-1',
      previousProviderType: ProviderType.OpcUa,
      providerType: ProviderType.Simulator,
    });

    expect(fakes.drivers[0].stop).toHaveBeenCalledTimes(1);
    expect(registry.hasProvider('machine-1')).toBe(false);
    expect(fakes.metrics.setDataProviderConnected).toHaveBeenLastCalledWith('machine-1', false);
  });

  it('un fallo al cargar la conexión nueva no se propaga al emisor del evento', async () => {
    const fakes = createFakes({ connections: [] });
    fakes.machineRepository.findById.mockRejectedValue(new Error('db down'));
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    await expect(
      registry.onMachineConnectionReplaced({
        machineId: 'machine-1',
        companyId: 'company-1',
        previousProviderType: null,
        providerType: ProviderType.OpcUa,
      }),
    ).resolves.toBeUndefined();
  });

  it('MachineDeactivated detiene el provider de esa Machine', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    await registry.onMachineDeactivated({ machineId: 'machine-1', companyId: 'company-1' });
    await registry.onMachineDeactivated({ machineId: 'machine-1', companyId: 'company-1' });

    expect(fakes.drivers[0].stop).toHaveBeenCalledTimes(1);
    expect(registry.hasProvider('machine-1')).toBe(false);
  });

  it('un error al detener el driver no se propaga', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    fakes.drivers[0].stop.mockRejectedValue(new Error('socket hang up'));

    await expect(
      registry.onMachineDeactivated({ machineId: 'machine-1', companyId: 'company-1' }),
    ).resolves.toBeUndefined();
  });

  it('onModuleDestroy detiene todos los providers', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();

    await registry.onModuleDestroy();

    expect(fakes.drivers[0].stop).toHaveBeenCalledTimes(1);
    expect(registry.hasProvider('machine-1')).toBe(false);
  });

  it('MachineSignalsChanged republica los últimos valores hacia el Signal Engine (spec 18)', async () => {
    const fakes = createFakes();
    const registry = createRegistry(fakes);
    await registry.onModuleInit();
    const listener = fakes.drivers[0].listener!;
    listener.onConnected();
    listener.onDataChange({
      nodeId: NODE,
      value: 4.5,
      builtInType: 'Float',
      isArray: false,
      severity: 'Good',
      statusCodeName: 'Good',
    });
    fakes.ingestSignalTick.execute.mockClear();

    registry.onMachineSignalsChanged({ machineId: 'machine-1', companyId: 'company-1' });
    registry.onMachineSignalsChanged({ machineId: 'otra-machine', companyId: 'company-1' });

    expect(fakes.ingestSignalTick.execute).toHaveBeenCalledTimes(1);
    expect(fakes.ingestSignalTick.execute).toHaveBeenCalledWith(
      expect.objectContaining({ variableName: 'Lectura_REAL_1', value: 4.5 }),
    );
  });
});

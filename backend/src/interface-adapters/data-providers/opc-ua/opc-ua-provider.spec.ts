import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';
import { DataQuality } from '../data-quality.enum';
import { VariableType } from '../variable-type.enum';
import type { Variable } from '../variable.vo';
import {
  type IOpcUaDriver,
  type IOpcUaDriverListener,
  type OpcUaDataChange,
  OpcUaSessionUnavailableError,
} from './opc-ua-driver.port';
import { OpcUaProvider } from './opc-ua-provider';

const NOW = new Date('2026-10-30T12:00:00Z');
const REAL_NODE = 'ns=3;s="Lectura"."REAL_1"';
const BOOL_NODE = 'ns=3;s="Lectura"."BOOL_1"';
const CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    { nodeId: REAL_NODE, signalVariableName: 'Lectura_REAL_1' },
    { nodeId: BOOL_NODE, signalVariableName: 'Lectura_BOOL_1' },
  ],
};

class FakeDriver implements IOpcUaDriver {
  listener: IOpcUaDriverListener | undefined;
  start = vi.fn((listener: IOpcUaDriverListener) => {
    this.listener = listener;
  });
  stop = vi.fn(() => Promise.resolve());
  write = vi.fn((items: { nodeId: string }[]) =>
    Promise.resolve(items.map((item) => ({ nodeId: item.nodeId, statusCode: 'Good' }))),
  );
}

function change(overrides: Partial<OpcUaDataChange> = {}): OpcUaDataChange {
  return {
    nodeId: REAL_NODE,
    value: 12.5,
    builtInType: 'Float',
    isArray: false,
    severity: 'Good',
    statusCodeName: 'Good',
    ...overrides,
  };
}

async function createConnectedProvider() {
  const driver = new FakeDriver();
  const provider = new OpcUaProvider('machine-1', CONFIG, driver, () => NOW);
  const variables: Variable[] = [];
  provider.subscribe((variable) => variables.push(variable));
  await provider.connect();
  driver.listener!.onConnected();
  return { driver, provider, variables };
}

describe('OpcUaProvider', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connect() arranca el driver sin bloquear y es idempotente', async () => {
    const driver = new FakeDriver();
    const provider = new OpcUaProvider('machine-1', CONFIG, driver, () => NOW);

    await provider.connect();
    await provider.connect();

    expect(driver.start).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(false);
  });

  it('publica una Variable por notificación con el signalVariableName, tipo y calidad traducidos (criterio 7)', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change());

    expect(variables).toHaveLength(1);
    expect(variables[0]).toEqual({
      name: 'Lectura_REAL_1',
      value: 12.5,
      type: VariableType.Float,
      timestamp: NOW,
      quality: DataQuality.Good,
      correlationId: expect.any(String),
    });
  });

  it('usa siempre el reloj del Backend como timestamp, nunca el del PLC', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change());

    expect(variables[0].timestamp).toBe(NOW);
  });

  it('genera un correlationId distinto por notificación', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change());
    driver.listener!.onDataChange(change());

    expect(variables[0].correlationId).not.toBe(variables[1].correlationId);
  });

  it.each([
    ['Boolean', true, VariableType.Boolean],
    ['SByte', -3, VariableType.Integer],
    ['Byte', 3, VariableType.Integer],
    ['Int16', -300, VariableType.Integer],
    ['UInt16', 300, VariableType.Integer],
    ['Int32', -70000, VariableType.Integer],
    ['UInt32', 70000, VariableType.Integer],
    ['Float', 1.5, VariableType.Float],
    ['Double', 2.25, VariableType.Float],
    ['String', 'R-42', VariableType.String],
  ])('mapea el tipo %s a VariableType', async (builtInType, value, expectedType) => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ builtInType, value }));

    expect(variables[0]).toMatchObject({ value, type: expectedType });
  });

  it.each([
    ['Good', DataQuality.Good],
    ['Uncertain', DataQuality.Uncertain],
    ['Bad', DataQuality.Bad],
  ] as const)('traduce la severidad %s a %s', async (severity, quality) => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ severity }));

    expect(variables[0].quality).toBe(quality);
  });

  it('descarta arrays y tipos no escalares con un único warning por nodo', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ isArray: true, value: [1, 2] }));
    driver.listener!.onDataChange(change({ isArray: true, value: [1, 2] }));
    driver.listener!.onDataChange(change({ builtInType: 'ExtensionObject', value: {} }));

    expect(variables).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('descarta números no finitos', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ value: Number.NaN }));

    expect(variables).toHaveLength(0);
  });

  it('ignora notificaciones de nodos que no están en el nodeMapping', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ nodeId: 'ns=3;s="Otro"' }));

    expect(variables).toHaveLength(0);
  });

  it('una notificación BAD sin valor republica el último valor con calidad BAD', async () => {
    const { driver, variables } = await createConnectedProvider();
    driver.listener!.onDataChange(change({ value: 7 }));

    driver.listener!.onDataChange(
      change({
        value: null,
        builtInType: 'Null',
        severity: 'Bad',
        statusCodeName: 'BadNoCommunication',
      }),
    );

    expect(variables[1]).toMatchObject({
      name: 'Lectura_REAL_1',
      value: 7,
      type: VariableType.Float,
      quality: DataQuality.Bad,
    });
  });

  it('una notificación sin valor y sin valor previo no publica nada (no se inventan valores)', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onDataChange(change({ value: null, builtInType: 'Null', severity: 'Bad' }));

    expect(variables).toHaveLength(0);
  });

  it('un MonitoredItem rechazado solo registra un warning y no afecta al resto (criterio 10)', async () => {
    const { driver, variables } = await createConnectedProvider();

    driver.listener!.onMonitoredItemRejected(REAL_NODE, 'BadNodeIdUnknown');
    driver.listener!.onDataChange(
      change({ nodeId: BOOL_NODE, builtInType: 'Boolean', value: true }),
    );

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('BadNodeIdUnknown'));
    expect(variables).toHaveLength(1);
    expect(variables[0].name).toBe('Lectura_BOOL_1');
  });

  it('notifica los cambios de conexión a sus listeners (criterio 8)', async () => {
    const driver = new FakeDriver();
    const provider = new OpcUaProvider('machine-1', CONFIG, driver, () => NOW);
    const changes: boolean[] = [];
    provider.onConnectionChange((connected) => changes.push(connected));
    await provider.connect();

    driver.listener!.onConnected();
    driver.listener!.onDisconnected();
    driver.listener!.onDisconnected();
    driver.listener!.onConnected();

    expect(changes).toEqual([true, false, true]);
    expect(provider.isConnected()).toBe(true);
  });

  it('avisa una vez por conexión si el reloj del servidor difiere más de 5 minutos', async () => {
    const { driver } = await createConnectedProvider();

    driver.listener!.onServerTime(new Date('2012-01-08T00:59:33Z'));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('desfasado'));
  });

  it('no avisa si el desfase de reloj es menor de 5 minutos', async () => {
    const { driver } = await createConnectedProvider();

    driver.listener!.onServerTime(new Date(NOW.getTime() - 60_000));

    expect(warn).not.toHaveBeenCalled();
  });

  it('disconnect() detiene el driver e ignora eventos posteriores', async () => {
    const { driver, provider, variables } = await createConnectedProvider();
    const changes: boolean[] = [];
    provider.onConnectionChange((connected) => changes.push(connected));

    await provider.disconnect();
    driver.listener!.onDataChange(change());
    driver.listener!.onDisconnected();

    expect(driver.stop).toHaveBeenCalledTimes(1);
    expect(provider.isConnected()).toBe(false);
    expect(variables).toHaveLength(0);
    expect(changes).toEqual([]);
  });

  it('unsubscribe() deja de entregar Variables a ese listener', async () => {
    const { driver, provider } = await createConnectedProvider();
    const listener = vi.fn();
    provider.subscribe(listener);

    provider.unsubscribe(listener);
    driver.listener!.onDataChange(change());

    expect(listener).not.toHaveBeenCalled();
  });

  it('republishLastValues reenvía el último valor de cada variable con la hora actual', async () => {
    const { driver, provider, variables } = await createConnectedProvider();
    driver.listener!.onDataChange(change({ value: 7 }));
    driver.listener!.onDataChange(
      change({ nodeId: BOOL_NODE, builtInType: 'Boolean', value: true, severity: 'Uncertain' }),
    );
    variables.length = 0;

    provider.republishLastValues();

    expect(variables).toEqual([
      expect.objectContaining({ name: 'Lectura_REAL_1', value: 7, quality: DataQuality.Good }),
      expect.objectContaining({
        name: 'Lectura_BOOL_1',
        value: true,
        quality: DataQuality.Uncertain,
      }),
    ]);
    expect(variables[0].timestamp).toBe(NOW);
  });

  it('republishLastValues no publica nada si el provider no está conectado', async () => {
    const { driver, provider, variables } = await createConnectedProvider();
    driver.listener!.onDataChange(change({ value: 7 }));
    driver.listener!.onDisconnected();
    variables.length = 0;

    provider.republishLastValues();

    expect(variables).toHaveLength(0);
  });

  describe('write (docs/specs/20-paquetes-escritura-opc-ua.md)', () => {
    const ITEMS = [{ nodeId: 'ns=3;s="Escritura"."REAL"', dataType: 'Float', value: 120 }];

    it('delega en el driver si está conectado', async () => {
      const { driver, provider } = await createConnectedProvider();

      await expect(provider.write(ITEMS)).resolves.toEqual([
        { nodeId: 'ns=3;s="Escritura"."REAL"', statusCode: 'Good' },
      ]);
      expect(driver.write).toHaveBeenCalledWith(ITEMS);
    });

    it('rechaza con OpcUaSessionUnavailableError si no está conectado', async () => {
      const { driver, provider } = await createConnectedProvider();
      driver.listener!.onDisconnected();

      await expect(provider.write(ITEMS)).rejects.toBeInstanceOf(OpcUaSessionUnavailableError);
      expect(driver.write).not.toHaveBeenCalled();
    });
  });
});

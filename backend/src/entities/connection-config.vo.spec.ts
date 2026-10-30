import { describe, expect, it } from 'vitest';
import {
  isOpcUaConnectionConfig,
  listKnownVariableNames,
  OPCUA_DEFAULT_SAMPLING_INTERVAL_MS,
  OPCUA_DEFAULT_TIMEOUT_MS,
  parseOpcUaConnectionConfig,
  parseOpcUaEndpointUrl,
  type OpcUaConnectionConfig,
} from './connection-config.vo';

const VALID_OPCUA_CONFIG = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    { nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' },
    { nodeId: 'ns=3;s="Lectura"."BOOL_1"', signalVariableName: 'Lectura_BOOL_1' },
  ],
};

function expectInvalid(raw: unknown): string {
  const result = parseOpcUaConnectionConfig(raw);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.reason;
}

describe('listKnownVariableNames', () => {
  it('extrae el variableName de cada SimulatorSignalSeed, cualquiera que sea su variante', () => {
    const config = {
      seedProfile: 'demo',
      signals: [
        { variableName: 'temperature', min: 0, max: 100, stepMax: 1 },
        { variableName: 'counter', mode: 'incremental' as const },
        { variableName: 'cycle', mode: 'cycle' as const, cycleTicks: 10 },
      ],
    };

    expect(listKnownVariableNames(config)).toEqual(['temperature', 'counter', 'cycle']);
  });

  it('devuelve un array vacío cuando la MachineConnection no tiene señales seed', () => {
    expect(listKnownVariableNames({ seedProfile: 'empty', signals: [] })).toEqual([]);
  });

  it('para una config OpcUa devuelve los signalVariableName de su nodeMapping (spec 18)', () => {
    expect(listKnownVariableNames(VALID_OPCUA_CONFIG as OpcUaConnectionConfig)).toEqual([
      'Lectura_REAL_1',
      'Lectura_BOOL_1',
    ]);
  });
});

describe('isOpcUaConnectionConfig', () => {
  it('distingue una config OpcUa de una del Simulador por su forma', () => {
    expect(isOpcUaConnectionConfig(VALID_OPCUA_CONFIG as OpcUaConnectionConfig)).toBe(true);
    expect(isOpcUaConnectionConfig({ seedProfile: 'empty', signals: [] })).toBe(false);
  });
});

describe('parseOpcUaEndpointUrl', () => {
  it('acepta opc.tcp:// con IP y puerto y devuelve el host', () => {
    expect(parseOpcUaEndpointUrl('opc.tcp://192.168.1.1:4840')).toEqual({
      ok: true,
      host: '192.168.1.1',
    });
  });

  it('acepta un hostname sin puerto', () => {
    expect(parseOpcUaEndpointUrl('opc.tcp://plc-1.local')).toEqual({
      ok: true,
      host: 'plc-1.local',
    });
  });

  it.each([
    ['http://192.168.1.1:4840'],
    ['opc.https://192.168.1.1'],
    ['192.168.1.1:4840'],
    ['opc.tcp://'],
    [''],
    [`opc.tcp://${'a'.repeat(2050)}`],
    [42],
  ])('rechaza %s', (raw) => {
    expect(parseOpcUaEndpointUrl(raw).ok).toBe(false);
  });
});

describe('parseOpcUaConnectionConfig', () => {
  it('acepta una config completa válida', () => {
    expect(parseOpcUaConnectionConfig(VALID_OPCUA_CONFIG)).toEqual({
      ok: true,
      config: VALID_OPCUA_CONFIG,
    });
  });

  it('aplica valores por defecto a seguridad, timeoutMs y samplingIntervalMs si se omiten', () => {
    const result = parseOpcUaConnectionConfig({
      endpointUrl: 'opc.tcp://192.168.1.1:4840',
      nodeMapping: VALID_OPCUA_CONFIG.nodeMapping,
    });

    expect(result).toEqual({
      ok: true,
      config: {
        ...VALID_OPCUA_CONFIG,
        timeoutMs: OPCUA_DEFAULT_TIMEOUT_MS,
        samplingIntervalMs: OPCUA_DEFAULT_SAMPLING_INTERVAL_MS,
      },
    });
  });

  it('rechaza algo que no es un objeto', () => {
    expectInvalid(null);
    expectInvalid('opc.tcp://x');
    expectInvalid([]);
  });

  it('rechaza un endpointUrl cuyo esquema no es opc.tcp://', () => {
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, endpointUrl: 'http://192.168.1.1' })).toMatch(
      /endpointUrl/,
    );
  });

  it.each([
    ['securityMode', 'SignAndEncrypt'],
    ['securityPolicy', 'Basic256Sha256'],
    ['authMode', 'UserName'],
  ])('rechaza %s = %s (solo None/Anonymous en esta spec)', (field, value) => {
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, [field]: value })).toMatch(field);
  });

  it('rechaza campos no declarados, como certificateRef (OWASP A04)', () => {
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, certificateRef: 'cert-1' })).toMatch(
      /certificateRef/,
    );
  });

  it.each([
    ['timeoutMs', 0],
    ['timeoutMs', 120000],
    ['timeoutMs', 1.5],
    ['samplingIntervalMs', 10],
    ['samplingIntervalMs', 'rápido'],
  ])('rechaza %s = %s fuera de rango', (field, value) => {
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, [field]: value })).toMatch(field);
  });

  it('rechaza un nodeMapping vacío o que no es un array', () => {
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, nodeMapping: [] })).toMatch(/nodeMapping/);
    expect(expectInvalid({ ...VALID_OPCUA_CONFIG, nodeMapping: 'x' })).toMatch(/nodeMapping/);
  });

  it('rechaza una entrada de nodeMapping mal formada o con campos extra', () => {
    expectInvalid({ ...VALID_OPCUA_CONFIG, nodeMapping: ['ns=3;s=x'] });
    expectInvalid({
      ...VALID_OPCUA_CONFIG,
      nodeMapping: [{ nodeId: '', signalVariableName: 'a' }],
    });
    expectInvalid({
      ...VALID_OPCUA_CONFIG,
      nodeMapping: [{ nodeId: 'ns=3;s=x', signalVariableName: 'a', extra: true }],
    });
  });

  it.each([['1abc'], ['con espacio'], ['Lectura.REAL_1'], ['"Lectura"'], ['']])(
    'rechaza el signalVariableName %s (patrón de identificador del motor de fórmulas)',
    (name) => {
      expect(
        expectInvalid({
          ...VALID_OPCUA_CONFIG,
          nodeMapping: [{ nodeId: 'ns=3;s=x', signalVariableName: name }],
        }),
      ).toMatch(/signalVariableName/);
    },
  );

  it('rechaza nodeId o signalVariableName repetidos', () => {
    expect(
      expectInvalid({
        ...VALID_OPCUA_CONFIG,
        nodeMapping: [
          { nodeId: 'ns=3;s=x', signalVariableName: 'a' },
          { nodeId: 'ns=3;s=x', signalVariableName: 'b' },
        ],
      }),
    ).toMatch(/nodeId/);
    expect(
      expectInvalid({
        ...VALID_OPCUA_CONFIG,
        nodeMapping: [
          { nodeId: 'ns=3;s=x', signalVariableName: 'a' },
          { nodeId: 'ns=3;s=y', signalVariableName: 'a' },
        ],
      }),
    ).toMatch(/signalVariableName/);
  });
});

import { describe, expect, it } from 'vitest';
import type { OpcUaConnectionConfig } from './connection-config.vo';
import {
  executionStatusFrom,
  validateWritePackageItems,
  validateWriteValue,
} from './write-package.vo';
import { WritePackageExecutionStatus } from './write-package-execution-status.enum';

const CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    {
      nodeId: 'ns=3;s="Escritura"."REAL"',
      signalVariableName: 'Escritura_REAL',
      writable: true,
      dataType: 'Float',
      min: 0,
      max: 500,
    },
    {
      nodeId: 'ns=3;s="Escritura"."BOOL"',
      signalVariableName: 'Escritura_BOOL',
      writable: true,
      dataType: 'Boolean',
    },
    {
      nodeId: 'ns=3;s="Escritura"."INT"',
      signalVariableName: 'Escritura_INT',
      writable: true,
      dataType: 'Int16',
    },
    {
      nodeId: 'ns=3;s="Lectura"."REAL_1"',
      signalVariableName: 'Lectura_REAL_1',
      dataType: 'Float',
    },
  ],
};

describe('validateWriteValue', () => {
  it.each([
    ['Boolean', true],
    ['Boolean', false],
    ['Int16', -32768],
    ['Int16', 32767],
    ['UInt16', 65535],
    ['Byte', 255],
    ['SByte', -128],
    ['Int32', 2147483647],
    ['UInt32', 4294967295],
    ['Float', 12.5],
    ['Double', -0.001],
    ['String', 'R-42'],
  ])('acepta un %s con valor %s', (dataType, value) => {
    expect(validateWriteValue({ dataType }, value)).toEqual({ ok: true });
  });

  it.each([
    ['Boolean', 1],
    ['Boolean', 'true'],
    ['Int16', 3.5],
    ['Int16', 40000],
    ['UInt16', -1],
    ['Byte', 256],
    ['Int32', '12'],
    ['Float', 'abc'],
    ['Float', Number.NaN],
    ['Float', 4e38],
    ['Double', Number.POSITIVE_INFINITY],
    ['String', 42],
    ['String', 'x'.repeat(257)],
    ['ExtensionObject', 1],
  ])('rechaza un %s con valor %s', (dataType, value) => {
    expect(validateWriteValue({ dataType }, value).ok).toBe(false);
  });

  it('aplica los límites min/max de la variable', () => {
    expect(validateWriteValue({ dataType: 'Float', min: 0, max: 500 }, 500).ok).toBe(true);
    expect(validateWriteValue({ dataType: 'Float', min: 0, max: 500 }, 500.1).ok).toBe(false);
    expect(validateWriteValue({ dataType: 'Float', min: 0, max: 500 }, -1).ok).toBe(false);
  });
});

describe('validateWritePackageItems', () => {
  it('acepta elementos de variables escribibles con valores válidos', () => {
    expect(
      validateWritePackageItems(
        [
          { signalVariableName: 'Escritura_REAL', value: 120 },
          { signalVariableName: 'Escritura_BOOL', value: true },
        ],
        CONFIG,
      ),
    ).toEqual({ ok: true });
  });

  it('rechaza una lista vacía o de más de 50 elementos', () => {
    expect(validateWritePackageItems([], CONFIG).ok).toBe(false);
    const many = Array.from({ length: 51 }, () => ({
      signalVariableName: 'Escritura_REAL',
      value: 1,
    }));
    expect(validateWritePackageItems(many, CONFIG).ok).toBe(false);
  });

  it('rechaza variables repetidas', () => {
    const result = validateWritePackageItems(
      [
        { signalVariableName: 'Escritura_REAL', value: 1 },
        { signalVariableName: 'Escritura_REAL', value: 2 },
      ],
      CONFIG,
    );
    expect(result).toEqual({ ok: false, index: 1, reason: expect.stringMatching(/repetida/) });
  });

  it('rechaza una variable que no existe o no es escribible', () => {
    expect(
      validateWritePackageItems([{ signalVariableName: 'Lectura_REAL_1', value: 1 }], CONFIG),
    ).toEqual({ ok: false, index: 0, reason: expect.stringMatching(/no es escribible/) });
    expect(
      validateWritePackageItems([{ signalVariableName: 'NoExiste', value: 1 }], CONFIG),
    ).toEqual({ ok: false, index: 0, reason: expect.stringMatching(/no es escribible/) });
  });

  it('rechaza un valor fuera de tipo o de límites, indicando el elemento', () => {
    expect(
      validateWritePackageItems(
        [
          { signalVariableName: 'Escritura_BOOL', value: true },
          { signalVariableName: 'Escritura_INT', value: 40000 },
        ],
        CONFIG,
      ),
    ).toEqual({ ok: false, index: 1, reason: expect.stringMatching(/Int16/) });
  });

  it('sin config OPC UA (Simulador) ninguna variable es escribible', () => {
    expect(
      validateWritePackageItems([{ signalVariableName: 'Escritura_REAL', value: 1 }], {
        seedProfile: 'demo',
        signals: [],
      }).ok,
    ).toBe(false);
  });
});

describe('executionStatusFrom', () => {
  it('SUCCESS si todos son Good, PARTIAL si hay mezcla y FAILED si ninguno', () => {
    expect(executionStatusFrom(['Good', 'Good'])).toBe(WritePackageExecutionStatus.Success);
    expect(executionStatusFrom(['Good', 'BadNotWritable'])).toBe(
      WritePackageExecutionStatus.Partial,
    );
    expect(executionStatusFrom(['BadTypeMismatch', 'BadNotWritable'])).toBe(
      WritePackageExecutionStatus.Failed,
    );
    expect(executionStatusFrom([])).toBe(WritePackageExecutionStatus.Failed);
  });
});

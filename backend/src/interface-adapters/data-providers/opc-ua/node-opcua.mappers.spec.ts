import {
  DataType,
  DataValue,
  resolveNodeId,
  StatusCodes,
  Variant,
  VariantArrayType,
} from 'node-opcua-client';
import { describe, expect, it, vi } from 'vitest';
import {
  classifyConnectionError,
  OpcUaTimeoutError,
  severityOf,
  standardDataTypeName,
  toDataChange,
  withTimeout,
} from './node-opcua.mappers';

describe('severityOf', () => {
  it('clasifica los StatusCode por sus dos bits altos', () => {
    expect(severityOf(StatusCodes.Good.value)).toBe('Good');
    expect(severityOf(StatusCodes.UncertainLastUsableValue.value)).toBe('Uncertain');
    expect(severityOf(StatusCodes.BadNodeIdUnknown.value)).toBe('Bad');
    expect(severityOf(0xc0000000)).toBe('Bad');
  });
});

describe('toDataChange', () => {
  it('extrae valor, tipo, escalaridad y severidad de un DataValue', () => {
    const dataValue = new DataValue({
      value: new Variant({ dataType: DataType.Float, value: 1.5 }),
      statusCode: StatusCodes.Good,
    });

    expect(toDataChange('ns=3;s="Lectura"."REAL_1"', dataValue)).toEqual({
      nodeId: 'ns=3;s="Lectura"."REAL_1"',
      value: 1.5,
      builtInType: 'Float',
      isArray: false,
      severity: 'Good',
      statusCodeName: 'Good',
    });
  });

  it('marca los arrays', () => {
    const dataValue = new DataValue({
      value: new Variant({
        dataType: DataType.Double,
        arrayType: VariantArrayType.Array,
        value: [1, 2],
      }),
    });

    expect(toDataChange('n', dataValue).isArray).toBe(true);
  });

  it('una notificación Bad sin valor llega como value null y tipo Null', () => {
    const dataValue = new DataValue({ statusCode: StatusCodes.BadNoCommunication });

    expect(toDataChange('n', dataValue)).toMatchObject({
      value: null,
      builtInType: 'Null',
      isArray: false,
      severity: 'Bad',
      statusCodeName: 'BadNoCommunication',
    });
  });
});

describe('standardDataTypeName', () => {
  it('traduce los tipos estándar de ns=0 a su nombre', () => {
    expect(standardDataTypeName(resolveNodeId('ns=0;i=11'))).toBe('Double');
    expect(standardDataTypeName(resolveNodeId('ns=0;i=1'))).toBe('Boolean');
  });

  it('devuelve undefined para tipos propios del servidor', () => {
    expect(standardDataTypeName(resolveNodeId('ns=3;i=3003'))).toBeUndefined();
    expect(standardDataTypeName(resolveNodeId('ns=3;s=DT_"Lectura"."ARRAY_1"'))).toBeUndefined();
  });
});

describe('classifyConnectionError', () => {
  it.each([
    [new OpcUaTimeoutError(5000), 'TIMEOUT'],
    [new Error('Transaction has timed out'), 'TIMEOUT'],
    [new Error('BadSecurityPolicyRejected'), 'SECURITY_REJECTED'],
    [new Error('BadIdentityTokenRejected'), 'SECURITY_REJECTED'],
    [new Error('connect ECONNREFUSED 192.168.1.1:4840'), 'UNREACHABLE'],
    ['algo raro', 'UNREACHABLE'],
  ])('clasifica %s como %s', (error, reason) => {
    expect(classifyConnectionError(error)).toBe(reason);
  });
});

describe('withTimeout', () => {
  it('devuelve el resultado si llega a tiempo', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('rechaza con OpcUaTimeoutError si vence el plazo', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined), 1000);
    vi.advanceTimersByTime(1000);

    await expect(pending).rejects.toBeInstanceOf(OpcUaTimeoutError);
    vi.useRealTimers();
  });

  it('propaga el error del trabajo si falla antes del plazo', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
  });
});

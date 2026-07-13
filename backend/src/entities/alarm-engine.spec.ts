import { describe, expect, it } from 'vitest';
import { evaluateAlarmCondition } from './alarm-engine';

describe('evaluateAlarmCondition', () => {
  it.each([
    ['>', 84, 80, true],
    ['>', 75, 80, false],
    ['>=', 80, 80, true],
    ['<', 75, 80, true],
    ['<', 84, 80, false],
    ['<=', 80, 80, true],
  ] as const)('%s: value=%s threshold=%s => %s', (operator, value, threshold, expected) => {
    expect(evaluateAlarmCondition({ operator, threshold, value })).toBe(expected);
  });

  it('== compara igualdad estricta sobre valores booleanos', () => {
    expect(evaluateAlarmCondition({ operator: '==', threshold: true, value: true })).toBe(true);
    expect(evaluateAlarmCondition({ operator: '==', threshold: true, value: false })).toBe(false);
  });

  it('!= compara desigualdad estricta sobre valores string', () => {
    expect(evaluateAlarmCondition({ operator: '!=', threshold: 'OK', value: 'FAULT' })).toBe(true);
    expect(evaluateAlarmCondition({ operator: '!=', threshold: 'OK', value: 'OK' })).toBe(false);
  });

  it('devuelve undefined (no lanza) para un operador numérico con un value no numérico', () => {
    expect(evaluateAlarmCondition({ operator: '>', threshold: 80, value: true })).toBeUndefined();
    expect(
      evaluateAlarmCondition({ operator: '>', threshold: 80, value: 'FAULT' }),
    ).toBeUndefined();
  });

  it('devuelve undefined para un operador numérico con un threshold no numérico', () => {
    expect(
      evaluateAlarmCondition({ operator: '>=', threshold: true as never, value: 80 }),
    ).toBeUndefined();
  });
});

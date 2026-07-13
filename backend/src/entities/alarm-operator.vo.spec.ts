import { describe, expect, it } from 'vitest';
import { ALARM_OPERATORS, isAlarmOperator, isNumericOperator } from './alarm-operator.vo';

describe('isAlarmOperator', () => {
  it.each(ALARM_OPERATORS)('devuelve true para el operador %s', (operator) => {
    expect(isAlarmOperator(operator)).toBe(true);
  });

  it('devuelve false para un operador desconocido', () => {
    expect(isAlarmOperator('<>')).toBe(false);
  });

  it('devuelve false para un valor que no es string', () => {
    expect(isAlarmOperator(1)).toBe(false);
  });
});

describe('isNumericOperator', () => {
  it.each(['>', '>=', '<', '<='] as const)('devuelve true para %s', (operator) => {
    expect(isNumericOperator(operator)).toBe(true);
  });

  it.each(['==', '!='] as const)('devuelve false para %s', (operator) => {
    expect(isNumericOperator(operator)).toBe(false);
  });
});

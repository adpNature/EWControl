import { describe, expect, it } from 'vitest';
import { FormulaEvaluationError, FormulaSyntaxError } from './formula-evaluator';
import {
  resolveDirectSignalValue,
  resolveFormulaSignalValue,
  worstSignalQuality,
} from './signal-engine';
import { SignalQuality } from './signal-quality.enum';

describe('resolveDirectSignalValue', () => {
  it('devuelve el mismo value/quality/timestamp recibidos para una Signal DIRECT', () => {
    const timestamp = new Date('2026-07-12T10:00:00Z');

    const result = resolveDirectSignalValue({
      value: 42.5,
      quality: SignalQuality.Good,
      timestamp,
    });

    expect(result).toEqual({ value: 42.5, quality: SignalQuality.Good, timestamp });
  });

  it('preserva calidades distintas de GOOD sin transformarlas', () => {
    const timestamp = new Date('2026-07-12T10:00:01Z');

    const result = resolveDirectSignalValue({
      value: true,
      quality: SignalQuality.Uncertain,
      timestamp,
    });

    expect(result.quality).toBe(SignalQuality.Uncertain);
    expect(result.value).toBe(true);
  });
});

describe('worstSignalQuality', () => {
  it('devuelve GOOD si todas las calidades son GOOD', () => {
    expect(worstSignalQuality([SignalQuality.Good, SignalQuality.Good])).toBe(SignalQuality.Good);
  });

  it('devuelve la peor calidad según GOOD < UNCERTAIN < BAD < OFFLINE', () => {
    expect(worstSignalQuality([SignalQuality.Good, SignalQuality.Uncertain])).toBe(
      SignalQuality.Uncertain,
    );
    expect(worstSignalQuality([SignalQuality.Uncertain, SignalQuality.Bad])).toBe(
      SignalQuality.Bad,
    );
    expect(worstSignalQuality([SignalQuality.Good, SignalQuality.Offline, SignalQuality.Bad])).toBe(
      SignalQuality.Offline,
    );
  });
});

describe('resolveFormulaSignalValue', () => {
  it('evalúa la expresión con los últimos valores conocidos (Potencia = Voltage * Current)', () => {
    const result = resolveFormulaSignalValue({
      expression: 'voltage * current',
      variableInputs: {
        voltage: {
          value: 230,
          quality: SignalQuality.Good,
          timestamp: new Date('2026-07-12T10:00:00Z'),
        },
        current: {
          value: 12,
          quality: SignalQuality.Good,
          timestamp: new Date('2026-07-12T10:00:01Z'),
        },
      },
    });

    expect(result.value).toBe(2760);
  });

  it('asigna la peor calidad de las Variables usadas', () => {
    const result = resolveFormulaSignalValue({
      expression: 'voltage * current',
      variableInputs: {
        voltage: {
          value: 230,
          quality: SignalQuality.Good,
          timestamp: new Date('2026-07-12T10:00:00Z'),
        },
        current: {
          value: 12,
          quality: SignalQuality.Offline,
          timestamp: new Date('2026-07-12T10:00:01Z'),
        },
      },
    });

    expect(result.quality).toBe(SignalQuality.Offline);
  });

  it('asigna el timestamp más reciente entre las Variables usadas', () => {
    const older = new Date('2026-07-12T10:00:00Z');
    const newer = new Date('2026-07-12T10:00:05Z');

    const result = resolveFormulaSignalValue({
      expression: 'a + b',
      variableInputs: {
        a: { value: 1, quality: SignalQuality.Good, timestamp: newer },
        b: { value: 2, quality: SignalQuality.Good, timestamp: older },
      },
    });

    expect(result.timestamp).toEqual(newer);
  });

  it('lanza FormulaEvaluationError ante división por cero', () => {
    expect(() =>
      resolveFormulaSignalValue({
        expression: 'a / b',
        variableInputs: {
          a: { value: 10, quality: SignalQuality.Good, timestamp: new Date() },
          b: { value: 0, quality: SignalQuality.Good, timestamp: new Date() },
        },
      }),
    ).toThrow(FormulaEvaluationError);
  });

  it('lanza FormulaEvaluationError si una Variable usada tiene un valor no numérico', () => {
    expect(() =>
      resolveFormulaSignalValue({
        expression: 'a + b',
        variableInputs: {
          a: { value: 10, quality: SignalQuality.Good, timestamp: new Date() },
          b: { value: true, quality: SignalQuality.Good, timestamp: new Date() },
        },
      }),
    ).toThrow(FormulaEvaluationError);
  });

  it('lanza FormulaSyntaxError si la expresión no es parseable', () => {
    expect(() =>
      resolveFormulaSignalValue({
        expression: '(a + b',
        variableInputs: {
          a: { value: 1, quality: SignalQuality.Good, timestamp: new Date() },
          b: { value: 2, quality: SignalQuality.Good, timestamp: new Date() },
        },
      }),
    ).toThrow(FormulaSyntaxError);
  });
});

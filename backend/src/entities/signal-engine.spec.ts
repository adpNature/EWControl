import { describe, expect, it } from 'vitest';
import { resolveDirectSignalValue } from './signal-engine';
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

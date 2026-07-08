import { describe, expect, it } from 'vitest';
import { clamp, nextRandomDelta } from './random-walk';

describe('clamp', () => {
  it('recorta un valor por debajo del mínimo', () => {
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('recorta un valor por encima del máximo', () => {
    expect(clamp(150, 0, 100)).toBe(100);
  });

  it('no modifica un valor dentro del rango', () => {
    expect(clamp(42, 0, 100)).toBe(42);
  });
});

describe('nextRandomDelta', () => {
  it('devuelve -stepMax cuando random() = 0', () => {
    expect(nextRandomDelta(15, () => 0)).toBe(-15);
  });

  it('devuelve +stepMax cuando random() se acerca a 1', () => {
    expect(nextRandomDelta(15, () => 1)).toBe(15);
  });

  it('devuelve 0 cuando random() = 0.5', () => {
    expect(nextRandomDelta(15, () => 0.5)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import type { RandomFn } from './random-walk';
import {
  createSignalTickGenerator,
  CycleGenerator,
  IncrementalGenerator,
  RandomWalkGenerator,
} from './signal-tick-generator';

/** LCG con semilla fija: determinístico entre ejecuciones, a diferencia de Math.random. */
function createSeededRandom(seed: number): RandomFn {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe('RandomWalkGenerator', () => {
  it('la primera lectura es el punto medio del rango', () => {
    const generator = new RandomWalkGenerator('WindingSpeed', 0, 1200, 15);
    expect(generator.tick()).toBe(600);
  });

  it('a partir de la segunda lectura aplica random walk desde el valor previo', () => {
    const generator = new RandomWalkGenerator('WindingSpeed', 0, 1200, 15, () => 1);
    expect(generator.tick()).toBe(600);
    expect(generator.tick()).toBe(615);
  });

  it('nunca supera el máximo aunque el delta sea siempre positivo', () => {
    const generator = new RandomWalkGenerator('WindingSpeed', 0, 1200, 15, () => 1);
    let last = generator.tick();
    for (let i = 0; i < 100; i++) {
      last = generator.tick();
      expect(last).toBeLessThanOrEqual(1200);
    }
    expect(last).toBe(1200);
  });

  it('nunca baja del mínimo aunque el delta sea siempre negativo', () => {
    const generator = new RandomWalkGenerator('WindingSpeed', 0, 1200, 15, () => 0);
    let last = generator.tick();
    for (let i = 0; i < 100; i++) {
      last = generator.tick();
      expect(last).toBeGreaterThanOrEqual(0);
    }
    expect(last).toBe(0);
  });

  it('mantiene el valor siempre dentro de rango y el paso acotado durante muchos ticks', () => {
    const random = createSeededRandom(42);
    const generator = new RandomWalkGenerator('MotorTemperature', 20, 90, 0.5, random);
    let previous = generator.tick();
    for (let i = 0; i < 1000; i++) {
      const current = generator.tick();
      expect(current).toBeGreaterThanOrEqual(20);
      expect(current).toBeLessThanOrEqual(90);
      expect(Math.abs(current - previous)).toBeLessThanOrEqual(0.5 + Number.EPSILON);
      previous = current;
    }
  });
});

describe('IncrementalGenerator', () => {
  it('nunca decrece a lo largo de múltiples ticks', () => {
    const generator = new IncrementalGenerator('PieceCounter');
    let previous = generator.tick();
    for (let i = 0; i < 10; i++) {
      const current = generator.tick();
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe('CycleGenerator', () => {
  it('solo cambia de valor cada cycleTicks ticks', () => {
    const generator = new CycleGenerator('RunStop', 3);

    expect(generator.tick()).toBe(false);
    expect(generator.tick()).toBe(false);
    expect(generator.tick()).toBe(true);

    expect(generator.tick()).toBe(true);
    expect(generator.tick()).toBe(true);
    expect(generator.tick()).toBe(false);
  });
});

describe('createSignalTickGenerator', () => {
  it('crea un RandomWalkGenerator para un seed numérico con min/max/stepMax', () => {
    const generator = createSignalTickGenerator({
      variableName: 'WindingSpeed',
      min: 0,
      max: 1200,
      stepMax: 15,
    });
    expect(generator).toBeInstanceOf(RandomWalkGenerator);
    expect(generator.variableName).toBe('WindingSpeed');
  });

  it('crea un IncrementalGenerator para mode "incremental"', () => {
    const generator = createSignalTickGenerator({
      variableName: 'PieceCounter',
      mode: 'incremental',
    });
    expect(generator).toBeInstanceOf(IncrementalGenerator);
  });

  it('crea un CycleGenerator para mode "cycle"', () => {
    const generator = createSignalTickGenerator({
      variableName: 'RunStop',
      mode: 'cycle',
      cycleTicks: 300,
    });
    expect(generator).toBeInstanceOf(CycleGenerator);
  });
});

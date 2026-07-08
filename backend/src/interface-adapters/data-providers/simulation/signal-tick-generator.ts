import type { SimulatorSignalSeed } from '../../../entities/connection-config.vo';
import { VariableType } from '../variable-type.enum';
import { clamp, nextRandomDelta, type RandomFn } from './random-walk';

/** Genera el valor de una Signal simulada en cada tick del `SimulationProvider`. */
export interface ISignalTickGenerator {
  readonly variableName: string;
  readonly variableType: VariableType;
  tick(): number | boolean;
}

/**
 * Random walk acotado (Documento 10, apartado 10.1). La primera lectura, al no
 * existir un valor previo, toma el punto medio del rango (spec 02, caso Given/When/Then).
 */
export class RandomWalkGenerator implements ISignalTickGenerator {
  readonly variableType = VariableType.Float;
  private currentValue: number | undefined;

  constructor(
    readonly variableName: string,
    private readonly min: number,
    private readonly max: number,
    private readonly stepMax: number,
    private readonly random: RandomFn = Math.random,
  ) {}

  tick(): number {
    if (this.currentValue === undefined) {
      this.currentValue = (this.min + this.max) / 2;
      return this.currentValue;
    }
    const delta = nextRandomDelta(this.stepMax, this.random);
    this.currentValue = clamp(this.currentValue + delta, this.min, this.max);
    return this.currentValue;
  }
}

/**
 * Signal de modo `incremental` (ej. `PieceCounter`, Documento 10 apartado 10.2).
 * El incremento real por ciclo Run/Stop pertenece a una spec futura; aquí basta
 * con garantizar que el valor nunca decrece (spec 02, criterio de aceptación 4).
 */
export class IncrementalGenerator implements ISignalTickGenerator {
  readonly variableType = VariableType.Integer;
  private currentValue = 0;

  constructor(readonly variableName: string) {}

  tick(): number {
    return this.currentValue;
  }
}

/**
 * Signal de modo `cycle` (ej. `RunStop`): el valor booleano solo cambia cada
 * `cycleTicks` ticks (spec 02, criterio de aceptación 5).
 */
export class CycleGenerator implements ISignalTickGenerator {
  readonly variableType = VariableType.Boolean;
  private currentValue = false;
  private ticksSinceChange = 0;

  constructor(
    readonly variableName: string,
    private readonly cycleTicks: number,
  ) {}

  tick(): boolean {
    this.ticksSinceChange += 1;
    if (this.ticksSinceChange >= this.cycleTicks) {
      this.currentValue = !this.currentValue;
      this.ticksSinceChange = 0;
    }
    return this.currentValue;
  }
}

/** Crea el generador correspondiente a la forma discriminada de `SimulatorSignalSeed`. */
export function createSignalTickGenerator(
  seed: SimulatorSignalSeed,
  random: RandomFn = Math.random,
): ISignalTickGenerator {
  if ('mode' in seed) {
    return seed.mode === 'incremental'
      ? new IncrementalGenerator(seed.variableName)
      : new CycleGenerator(seed.variableName, seed.cycleTicks);
  }
  return new RandomWalkGenerator(seed.variableName, seed.min, seed.max, seed.stepMax, random);
}

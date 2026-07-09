export const RANDOM_SOURCE = Symbol('RandomSource');

/**
 * Abstrae la fuente de aleatoriedad del random walk para que el caso de uso
 * (gestionado por Nest DI) sea determinista en tests, sin depender de un
 * parámetro de función sin decorar en el constructor.
 */
export interface IRandomSource {
  next(): number;
}

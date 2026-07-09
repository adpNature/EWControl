export const CLOCK = Symbol('Clock');

/**
 * Abstrae "el instante actual" para que el caso de uso sea determinista en
 * tests (ventana de 7 días reproducible), igual que `IUnitOfWork` abstrae la transacción.
 */
export interface IClock {
  now(): Date;
}

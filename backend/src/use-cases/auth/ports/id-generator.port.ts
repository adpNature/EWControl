export const ID_GENERATOR = Symbol('IdGenerator');

/** Abstrae la generación del `jti` del refresh token, para que sea determinista en tests. */
export interface IIdGenerator {
  generate(): string;
}

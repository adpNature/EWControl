export const PASSWORD_HASHER = Symbol('PasswordHasher');

/**
 * Hashing de contraseñas (Documento 6, apartado 6.2). Incluye `compare` aunque esta
 * spec solo llama a `hash`, porque es el mismo puerto que usará la spec 05 (login).
 */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  compare(plainPassword: string, hash: string): Promise<boolean>;
}

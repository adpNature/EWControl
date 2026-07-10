/** El refresh token no es válido: firma inválida, caducado, o su `jti` no existe. */
export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('El refresh token no es válido.');
    this.name = 'InvalidRefreshTokenError';
  }
}

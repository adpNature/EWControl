/** Más de 5 intentos fallidos de login por email en 15 min (docs/specs/05-auth-login.md, criterio 7). */
export class TooManyLoginAttemptsError extends Error {
  constructor() {
    super('Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo.');
    this.name = 'TooManyLoginAttemptsError';
  }
}

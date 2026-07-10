/**
 * Mensaje deliberadamente genérico: se lanza igual para email inexistente,
 * password incorrecta y cuenta/Company desactivada, para no revelar cuál fue
 * la causa (OWASP A07, docs/specs/05-auth-login.md, criterio 2).
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email o contraseña incorrectos.');
    this.name = 'InvalidCredentialsError';
  }
}

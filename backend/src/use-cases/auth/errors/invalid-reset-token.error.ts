/** El token de recuperación no existe, ya fue usado, o está expirado (docs/specs/10-gestion-companies-users.md). */
export class InvalidResetTokenError extends Error {
  constructor() {
    super('El enlace de recuperación ya no es válido.');
    this.name = 'InvalidResetTokenError';
  }
}

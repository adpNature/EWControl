/** Más de 3 solicitudes de forgot-password por email en 15 min (docs/specs/10-gestion-companies-users.md). */
export class TooManyPasswordResetRequestsError extends Error {
  constructor() {
    super('Demasiadas solicitudes. Espera unos minutos antes de volver a intentarlo.');
    this.name = 'TooManyPasswordResetRequestsError';
  }
}

export class CannotDeactivateSelfError extends Error {
  constructor() {
    super('Un User no puede darse de baja a sí mismo.');
    this.name = 'CannotDeactivateSelfError';
  }
}

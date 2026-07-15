export class CurrentPasswordInvalidError extends Error {
  constructor() {
    super('La contraseña actual no es correcta.');
    this.name = 'CurrentPasswordInvalidError';
  }
}

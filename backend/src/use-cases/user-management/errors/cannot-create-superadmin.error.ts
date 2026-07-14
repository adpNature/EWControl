export class CannotCreateSuperAdminError extends Error {
  constructor() {
    super('Un AdminCliente no puede crear ni ascender a un User con rol SuperAdmin.');
    this.name = 'CannotCreateSuperAdminError';
  }
}

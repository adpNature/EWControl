export class EmailAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`Ya existe un User con el email ${email}.`);
    this.name = 'EmailAlreadyExistsError';
  }
}

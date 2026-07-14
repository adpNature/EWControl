export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`No existe el User ${userId}.`);
    this.name = 'UserNotFoundError';
  }
}

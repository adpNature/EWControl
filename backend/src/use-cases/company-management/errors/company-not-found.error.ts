export class CompanyNotFoundError extends Error {
  constructor(companyId: string) {
    super(`No existe la Company ${companyId}.`);
    this.name = 'CompanyNotFoundError';
  }
}

export class CompanyIdRequiredError extends Error {
  constructor() {
    super('Un SuperAdmin debe indicar explícitamente el companyId al crear un User.');
    this.name = 'CompanyIdRequiredError';
  }
}

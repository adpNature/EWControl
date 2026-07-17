/** docs/specs/14-historicos-comparativas.md: 400 COMPANY_ID_REQUIRED. */
export class CompanyIdRequiredError extends Error {
  constructor() {
    super('Un SuperAdmin debe indicar explícitamente companyId al comparar históricos.');
    this.name = 'CompanyIdRequiredError';
  }
}

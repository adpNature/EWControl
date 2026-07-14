import { companyFormErrorMessage } from './company-form-error-message';

describe('companyFormErrorMessage', () => {
  it('mapea COMPANY_NOT_FOUND a un mensaje específico', () => {
    expect(
      companyFormErrorMessage({ status: 404, code: 'COMPANY_NOT_FOUND', message: 'x' }),
    ).toContain('No existe');
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    expect(companyFormErrorMessage({ status: 500, code: 'OTHER', message: 'x' })).toBe(
      'No se ha podido guardar la Company. Inténtalo de nuevo.',
    );
  });
});

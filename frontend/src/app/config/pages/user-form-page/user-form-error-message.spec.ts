import { userFormErrorMessage } from './user-form-error-message';

describe('userFormErrorMessage', () => {
  it('mapea EMAIL_ALREADY_EXISTS a un mensaje específico', () => {
    expect(
      userFormErrorMessage({ status: 409, code: 'EMAIL_ALREADY_EXISTS', message: 'x' }),
    ).toContain('email');
  });

  it('mapea FORBIDDEN a un mensaje específico', () => {
    expect(userFormErrorMessage({ status: 403, code: 'FORBIDDEN', message: 'x' })).toContain(
      'SuperAdmin',
    );
  });

  it('mapea COMPANY_ID_REQUIRED a un mensaje específico', () => {
    expect(
      userFormErrorMessage({ status: 422, code: 'COMPANY_ID_REQUIRED', message: 'x' }),
    ).toContain('Company');
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    expect(userFormErrorMessage({ status: 400, code: 'OTHER', message: 'x' })).toBe(
      'No se ha podido guardar el User. Inténtalo de nuevo.',
    );
  });
});

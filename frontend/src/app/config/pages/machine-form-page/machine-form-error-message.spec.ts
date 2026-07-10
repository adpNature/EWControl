import { machineFormErrorMessage } from './machine-form-error-message';

describe('machineFormErrorMessage', () => {
  it('mapea MACHINE_INACTIVE a un mensaje específico', () => {
    expect(
      machineFormErrorMessage({ status: 422, code: 'MACHINE_INACTIVE', message: 'irrelevante' }),
    ).toContain('desactivada');
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    expect(
      machineFormErrorMessage({ status: 500, code: 'INTERNAL_ERROR', message: 'irrelevante' }),
    ).toBe('No se ha podido guardar la Machine. Inténtalo de nuevo.');
  });
});

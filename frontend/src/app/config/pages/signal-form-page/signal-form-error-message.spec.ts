import { signalFormErrorMessage } from './signal-form-error-message';

describe('signalFormErrorMessage', () => {
  it('mapea FORMULA_REFERENCES_UNKNOWN_VARIABLE al campo variables', () => {
    const mapping = signalFormErrorMessage({
      status: 422,
      code: 'FORMULA_REFERENCES_UNKNOWN_VARIABLE',
      message: 'irrelevante',
    });

    expect(mapping.field).toBe('variables');
    expect(mapping.message).toContain('variable');
  });

  it('mapea MACHINE_INACTIVE sin asociarlo a ningún campo', () => {
    const mapping = signalFormErrorMessage({
      status: 422,
      code: 'MACHINE_INACTIVE',
      message: 'irrelevante',
    });

    expect(mapping.field).toBeNull();
    expect(mapping.message).toContain('desactivada');
  });

  it('usa un mensaje genérico para cualquier otro código', () => {
    const mapping = signalFormErrorMessage({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'irrelevante',
    });

    expect(mapping.field).toBeNull();
    expect(mapping.message).toBe('No se ha podido guardar la Signal. Inténtalo de nuevo.');
  });
});

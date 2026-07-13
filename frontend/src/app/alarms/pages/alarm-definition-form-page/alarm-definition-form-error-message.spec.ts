import { ApiError } from '../../../core/http/api-error.model';
import { alarmDefinitionFormErrorMessage } from './alarm-definition-form-error-message';

function apiError(code: string): ApiError {
  return { status: 404, code, message: 'x' };
}

describe('alarmDefinitionFormErrorMessage', () => {
  it('mapea SIGNAL_NOT_FOUND a un mensaje de "ya no existe"', () => {
    expect(alarmDefinitionFormErrorMessage(apiError('SIGNAL_NOT_FOUND'))).toContain('ya no existe');
  });

  it('mapea ALARM_DEFINITION_NOT_FOUND a un mensaje de "ya no existe"', () => {
    expect(alarmDefinitionFormErrorMessage(apiError('ALARM_DEFINITION_NOT_FOUND'))).toContain(
      'ya no existe',
    );
  });

  it('devuelve un mensaje genérico para cualquier otro código', () => {
    expect(alarmDefinitionFormErrorMessage(apiError('UNKNOWN_ERROR'))).toBe(
      'No se ha podido guardar la regla de alarma. Inténtalo de nuevo.',
    );
  });
});

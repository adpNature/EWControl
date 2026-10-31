import {
  executionDisabledReason,
  executionReasonLabel,
  executionStatusLabel,
  formatWriteValue,
  isNumericDataType,
  parseInputValue,
  statusCodeLabel,
  writableVariables,
  writePackageErrorMessage,
  writeValueError,
} from './write-package-rules';

describe('writableVariables', () => {
  it('solo devuelve las variables marcadas como escribibles con un tipo soportado', () => {
    const result = writableVariables([
      { nodeId: 'a', signalVariableName: 'A', writable: true, dataType: 'Float' },
      { nodeId: 'b', signalVariableName: 'B', dataType: 'Float' },
      { nodeId: 'c', signalVariableName: 'C', writable: true },
      { nodeId: 'd', signalVariableName: 'D', writable: true, dataType: 'ExtensionObject' },
    ]);

    expect(result.map((entry) => entry.signalVariableName)).toEqual(['A']);
  });
});

describe('writeValueError', () => {
  it.each([
    [{ dataType: 'Boolean' }, true],
    [{ dataType: 'Int16' }, -32768],
    [{ dataType: 'Float', min: 0, max: 500 }, 500],
    [{ dataType: 'String' }, 'R-42'],
  ])('acepta %o con %s', (variable, value) => {
    expect(writeValueError(variable, value)).toBeNull();
  });

  it.each([
    [{ dataType: 'Boolean' }, 'sí', /verdadero o falso/],
    [{ dataType: 'Int16' }, 3.5, /Entero entre/],
    [{ dataType: 'Byte' }, 256, /Entero entre 0 y 255/],
    [{ dataType: 'Float' }, null, /número/],
    [{ dataType: 'Float', min: 0 }, -1, /Mínimo 0/],
    [{ dataType: 'Float', max: 500 }, 501, /Máximo 500/],
    [{ dataType: 'String' }, 'x'.repeat(257), /256/],
  ])('rechaza %o con %s', (variable, value, message) => {
    expect(writeValueError(variable, value as never)).toMatch(message);
  });
});

describe('parseInputValue / formatWriteValue / isNumericDataType', () => {
  it('convierte el texto del input al tipo de la variable', () => {
    expect(parseInputValue('Float', '12,5')).toBe(12.5);
    expect(parseInputValue('Int16', ' 7 ')).toBe(7);
    expect(parseInputValue('Int16', '')).toBeNull();
    expect(parseInputValue('Boolean', true)).toBe(true);
    expect(parseInputValue('Boolean', 'false')).toBe(false);
    expect(parseInputValue('String', 'R-42')).toBe('R-42');
  });

  it('formatea booleanos en castellano', () => {
    expect(formatWriteValue(true)).toBe('Verdadero');
    expect(formatWriteValue(false)).toBe('Falso');
    expect(formatWriteValue(12.5)).toBe('12.5');
  });

  it('distingue tipos numéricos', () => {
    expect(isNumericDataType('Double')).toBe(true);
    expect(isNumericDataType('Boolean')).toBe(false);
    expect(isNumericDataType(undefined)).toBe(false);
  });
});

describe('etiquetas de resultado', () => {
  it('traduce estado, StatusCode y motivo', () => {
    expect(executionStatusLabel('PARTIAL')).toBe('Escrito parcialmente');
    expect(statusCodeLabel('Good')).toBe('Escrito');
    expect(statusCodeLabel('BadNotWritable')).toMatch(/no permite escribir/);
    expect(statusCodeLabel('BadWhatever')).toBe('Error del PLC (BadWhatever)');
    expect(executionReasonLabel('TIMEOUT')).toMatch(/pudo llegar a escribirse/);
    expect(executionReasonLabel(null)).toBeNull();
  });
});

describe('writePackageErrorMessage', () => {
  it.each([
    ['MACHINE_NOT_CONNECTED', /no está conectada/],
    ['WRITE_IN_PROGRESS', /otra escritura en curso/],
    ['WRITE_PACKAGE_OUTDATED', /ya no es válido/],
    ['WRITE_PACKAGE_NAME_TAKEN', /Ya existe/],
    ['DESCONOCIDO', /No se ha podido completar/],
  ])('traduce %s', (code, expected) => {
    expect(writePackageErrorMessage({ status: 409, code, message: '' })).toMatch(expected);
  });

  it('incluye el motivo de INVALID_WRITE_PACKAGE', () => {
    expect(
      writePackageErrorMessage({
        status: 400,
        code: 'INVALID_WRITE_PACKAGE',
        message: '',
        details: { index: 1, reason: 'el valor de X es mayor que el máximo permitido (500)' },
      }),
    ).toBe('El paquete no es válido: el valor de X es mayor que el máximo permitido (500).');
  });
});

describe('executionDisabledReason', () => {
  it('permite ejecutar en una Machine OPC UA conectada', () => {
    expect(
      executionDisabledReason({ providerType: 'OpcUa', connected: true, packages: [] }),
    ).toBeNull();
  });

  it('explica si la Machine no es OPC UA o está desconectada', () => {
    expect(
      executionDisabledReason({ providerType: 'Simulator', connected: true, packages: [] }),
    ).toMatch(/no es OPC UA/);
    expect(
      executionDisabledReason({ providerType: 'OpcUa', connected: false, packages: [] }),
    ).toMatch(/no está conectada/);
  });

  it('sin listado cargado no bloquea', () => {
    expect(executionDisabledReason(null)).toBeNull();
  });
});

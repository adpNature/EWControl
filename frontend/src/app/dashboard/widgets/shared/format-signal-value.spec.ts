import { formatSignalValue } from './format-signal-value';

describe('formatSignalValue', () => {
  it('redondea a 2 decimales por defecto, con coma decimal', () => {
    expect(formatSignalValue(15.658178370778186)).toBe('15,66');
  });

  it('completa con ceros hasta el número de decimales indicado', () => {
    expect(formatSignalValue(10, 2)).toBe('10,00');
  });

  it('respeta un número de decimales distinto de 2', () => {
    expect(formatSignalValue(15.658178370778186, 0)).toBe('16');
  });

  it('devuelve valores no numéricos (booleanos, strings) sin transformar', () => {
    expect(formatSignalValue(true)).toBe('true');
    expect(formatSignalValue(false)).toBe('false');
  });
});

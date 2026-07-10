import { describe, expect, it } from 'vitest';
import { findUnknownVariables, isFormulaSignalSource } from './signal-source.vo';

describe('isFormulaSignalSource', () => {
  it('devuelve true para una FormulaSignalSource', () => {
    expect(isFormulaSignalSource({ expression: 'a - b', variables: ['a', 'b'] })).toBe(true);
  });

  it('devuelve false para una DirectSignalSource', () => {
    expect(isFormulaSignalSource({ variableName: 'temperature' })).toBe(false);
  });
});

describe('findUnknownVariables', () => {
  it('devuelve un array vacío cuando todas las variables son conocidas', () => {
    const source = { expression: 'temperature - pressure', variables: ['temperature', 'pressure'] };

    expect(findUnknownVariables(source, ['temperature', 'pressure', 'humidity'])).toEqual([]);
  });

  it('devuelve las variables que no están en la lista de conocidas', () => {
    const source = {
      expression: 'temperature - unknownVar',
      variables: ['temperature', 'unknownVar'],
    };

    expect(findUnknownVariables(source, ['temperature', 'pressure'])).toEqual(['unknownVar']);
  });

  it('devuelve todas las variables cuando la lista de conocidas está vacía', () => {
    const source = { expression: 'a + b', variables: ['a', 'b'] };

    expect(findUnknownVariables(source, [])).toEqual(['a', 'b']);
  });
});

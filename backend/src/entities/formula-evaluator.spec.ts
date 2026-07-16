import { describe, expect, it } from 'vitest';
import {
  evaluateFormulaAst,
  FormulaEvaluationError,
  FormulaSyntaxError,
  getReferencedVariableNames,
  parseFormulaExpression,
  validateFormulaExpression,
} from './formula-evaluator';

describe('parseFormulaExpression + evaluateFormulaAst', () => {
  it('evalúa una multiplicación simple entre dos Variables (docs/02-arquitectura.md, ejemplo Potencia = Voltage * Current)', () => {
    const ast = parseFormulaExpression('voltage * current');

    expect(evaluateFormulaAst(ast, { voltage: 230, current: 12 })).toBe(2760);
  });

  it('respeta la precedencia de operadores (multiplicación antes que suma)', () => {
    const ast = parseFormulaExpression('a + b * c');

    expect(evaluateFormulaAst(ast, { a: 2, b: 3, c: 4 })).toBe(14);
  });

  it('respeta los paréntesis', () => {
    const ast = parseFormulaExpression('(a + b) * c');

    expect(evaluateFormulaAst(ast, { a: 2, b: 3, c: 4 })).toBe(20);
  });

  it('soporta la negación unaria', () => {
    const ast = parseFormulaExpression('-a + b');

    expect(evaluateFormulaAst(ast, { a: 5, b: 3 })).toBe(-2);
  });

  it('soporta la resta y la división', () => {
    expect(evaluateFormulaAst(parseFormulaExpression('a - b'), { a: 10, b: 3 })).toBe(7);
    expect(evaluateFormulaAst(parseFormulaExpression('a / b'), { a: 10, b: 5 })).toBe(2);
  });

  it('soporta literales numéricos decimales y multiplicación por constante (Producción Hora = Piezas * 60)', () => {
    const ast = parseFormulaExpression('pieces * 60');

    expect(evaluateFormulaAst(ast, { pieces: 1.5 })).toBe(90);
  });

  it('lanza FormulaSyntaxError con paréntesis desbalanceados', () => {
    expect(() => parseFormulaExpression('(a + b')).toThrow(FormulaSyntaxError);
  });

  it('lanza FormulaSyntaxError con un operador colgante', () => {
    expect(() => parseFormulaExpression('a +')).toThrow(FormulaSyntaxError);
  });

  it('lanza FormulaSyntaxError con un token sobrante al final', () => {
    expect(() => parseFormulaExpression('a b')).toThrow(FormulaSyntaxError);
  });

  it('lanza FormulaSyntaxError con una expresión vacía', () => {
    expect(() => parseFormulaExpression('   ')).toThrow(FormulaSyntaxError);
  });

  it('lanza FormulaSyntaxError con un carácter no reconocido', () => {
    expect(() => parseFormulaExpression('a % b')).toThrow(FormulaSyntaxError);
  });

  it('lanza FormulaEvaluationError ante división por cero', () => {
    const ast = parseFormulaExpression('a / b');

    expect(() => evaluateFormulaAst(ast, { a: 10, b: 0 })).toThrow(FormulaEvaluationError);
  });

  it('lanza FormulaEvaluationError si una Variable referenciada no tiene valor conocido', () => {
    const ast = parseFormulaExpression('a + b');

    expect(() => evaluateFormulaAst(ast, { a: 1 })).toThrow(FormulaEvaluationError);
  });
});

describe('getReferencedVariableNames', () => {
  it('devuelve los nombres únicos, en orden de aparición', () => {
    const ast = parseFormulaExpression('a + b * a - c');

    expect(getReferencedVariableNames(ast)).toEqual(['a', 'b', 'c']);
  });

  it('devuelve un array vacío si la expresión no referencia ninguna Variable', () => {
    const ast = parseFormulaExpression('2 * 60');

    expect(getReferencedVariableNames(ast)).toEqual([]);
  });

  it('recorre el operando de una negación unaria', () => {
    const ast = parseFormulaExpression('-a');

    expect(getReferencedVariableNames(ast)).toEqual(['a']);
  });
});

describe('validateFormulaExpression', () => {
  it('es válida cuando la expresión parsea y solo usa variables declaradas', () => {
    expect(validateFormulaExpression('Voltage * Current', ['Voltage', 'Current'])).toEqual({
      valid: true,
    });
  });

  it('es inválida cuando la expresión no es parseable', () => {
    const result = validateFormulaExpression('(Voltage * Current', ['Voltage', 'Current']);

    expect(result.valid).toBe(false);
  });

  it('es inválida cuando la expresión usa una variable no declarada', () => {
    const result = validateFormulaExpression('Voltage * Current', ['Voltage']);

    expect(result).toEqual({
      valid: false,
      reason: 'La expresión usa variables no declaradas en "variables": Current.',
    });
  });

  it('no exige que se usen todas las variables declaradas', () => {
    expect(validateFormulaExpression('Voltage', ['Voltage', 'Current'])).toEqual({ valid: true });
  });
});

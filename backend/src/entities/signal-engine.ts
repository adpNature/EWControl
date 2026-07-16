import {
  evaluateFormulaAst,
  FormulaEvaluationError,
  parseFormulaExpression,
} from './formula-evaluator';
import { SignalQuality } from './signal-quality.enum';

/**
 * Entrada de un tick ya traducido a valores de dominio (Documento 2, apartado 2.5).
 * La traducción desde `Variable`/`DataQuality` (Interface Adapters) ocurre en quien
 * llama a esta función, nunca aquí: entities no conoce Data Providers.
 */
export type DirectTickInput = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

export type ResolvedSignalValue = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

/**
 * Resuelve el valor de una Signal `DIRECT`: hoy es un mapeo identidad porque el
 * valor de la Variable ya es el valor de la Signal (Documento 3, apartado 3.2.5).
 */
export function resolveDirectSignalValue(input: DirectTickInput): ResolvedSignalValue {
  return { value: input.value, quality: input.quality, timestamp: input.timestamp };
}

/** Orden de severidad de `docs/02-arquitectura.md`, apartado 2.5 ("Calidad del Dato"). */
const QUALITY_SEVERITY: Record<SignalQuality, number> = {
  [SignalQuality.Good]: 0,
  [SignalQuality.Uncertain]: 1,
  [SignalQuality.Bad]: 2,
  [SignalQuality.Offline]: 3,
};

/** La peor calidad de una lista (spec 13): una FORMULA nunca es más fiable que su entrada menos fiable. */
export function worstSignalQuality(qualities: readonly SignalQuality[]): SignalQuality {
  return qualities.reduce(
    (worst, quality) => (QUALITY_SEVERITY[quality] > QUALITY_SEVERITY[worst] ? quality : worst),
    SignalQuality.Good,
  );
}

/** Último valor/calidad/timestamp conocido de una Variable referenciada por una FORMULA (spec 13). */
export type FormulaVariableInput = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

export type FormulaResolutionInput = {
  expression: string;
  /** Debe incluir exactamente las Variables de `FormulaSignalSource.variables`; ver `entities/formula-evaluator.ts`. */
  variableInputs: Readonly<Record<string, FormulaVariableInput>>;
};

/**
 * Resuelve el valor de una Signal `FORMULA` (spec 13): evalúa la expresión con
 * los últimos valores conocidos de sus Variables, y calcula la calidad (la peor
 * de las usadas) y el timestamp (el más reciente) del resultado. Asume que el
 * llamador ya comprobó que todas las Variables referenciadas tienen un valor
 * conocido (`docs/specs/13-motor-formulas-signal-engine.md`, "Variable sin
 * ningún tick todavía → se omite el cálculo"): esa decisión de omitir vive en
 * el use case, no aquí. Lanza `FormulaSyntaxError`/`FormulaEvaluationError`
 * ante una expresión inválida, división por cero o una Variable no numérica.
 */
export function resolveFormulaSignalValue(input: FormulaResolutionInput): ResolvedSignalValue {
  const numericValues: Record<string, number> = {};
  for (const [name, variableInput] of Object.entries(input.variableInputs)) {
    if (typeof variableInput.value !== 'number') {
      throw new FormulaEvaluationError(`La variable "${name}" no tiene un valor numérico.`);
    }
    numericValues[name] = variableInput.value;
  }

  const ast = parseFormulaExpression(input.expression);
  const value = evaluateFormulaAst(ast, numericValues);
  const variableInputs = Object.values(input.variableInputs);
  const quality = worstSignalQuality(variableInputs.map((variableInput) => variableInput.quality));
  const timestamp = new Date(
    Math.max(...variableInputs.map((variableInput) => variableInput.timestamp.getTime())),
  );

  return { value, quality, timestamp };
}

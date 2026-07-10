/**
 * Origen del valor de una Signal (Documento 3, apartado 3.4).
 */
export type DirectSignalSource = {
  variableName: string;
};

/**
 * Una Signal FORMULA únicamente puede referenciar Variables de su misma Machine
 * (Documento 3, apartado 3.2.5) — esa validación vive en el use-case, no aquí.
 */
export type FormulaSignalSource = {
  expression: string;
  variables: string[];
};

export type SignalSource = DirectSignalSource | FormulaSignalSource;

export function isFormulaSignalSource(source: SignalSource): source is FormulaSignalSource {
  return 'variables' in source;
}

export function findUnknownVariables(
  source: FormulaSignalSource,
  knownVariableNames: readonly string[],
): string[] {
  return source.variables.filter((variable) => !knownVariableNames.includes(variable));
}

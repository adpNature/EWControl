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

/**
 * Nombres de variable que usan las Signals activas, sin repetir y en orden de
 * aparición (DIRECT `variableName` y FORMULA `variables`). Son las únicas que
 * el `OpcUaProvider` necesita suscribir (docs/specs/24-conexion-opc-ua-estable.md,
 * criterio 1).
 */
export function listReferencedVariableNames(
  signals: readonly { isActive: boolean; signalSource: SignalSource }[],
): string[] {
  const names = new Set<string>();
  for (const signal of signals) {
    if (!signal.isActive) continue;
    const source = signal.signalSource;
    for (const name of isFormulaSignalSource(source) ? source.variables : [source.variableName]) {
      names.add(name);
    }
  }
  return [...names];
}

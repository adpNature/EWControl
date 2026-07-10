export class FormulaReferencesUnknownVariableError extends Error {
  constructor(public readonly unknownVariables: string[]) {
    super(
      `La fórmula referencia variables que no existen en esta Machine: ${unknownVariables.join(', ')}.`,
    );
    this.name = 'FormulaReferencesUnknownVariableError';
  }
}

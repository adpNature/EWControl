export class FormulaExpressionInvalidError extends Error {
  constructor(public readonly reason: string) {
    super(`La expresión de la fórmula no es válida: ${reason}`);
    this.name = 'FormulaExpressionInvalidError';
  }
}

/** docs/specs/23-categorias-variables-plc.md: otra categoría del mismo padre ya tiene ese nombre. */
export class VariableCategoryNameTakenError extends Error {
  constructor(readonly categoryName: string) {
    super(`Ya hay otra categoría llamada "${categoryName}" en el mismo nivel.`);
    this.name = 'VariableCategoryNameTakenError';
  }
}

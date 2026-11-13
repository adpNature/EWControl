/** docs/specs/23-categorias-variables-plc.md: la categoría no existe o no es de esa Machine. */
export class VariableCategoryNotFoundError extends Error {
  constructor(readonly categoryId: string) {
    super(`La categoría ${categoryId} no existe en esta Machine.`);
    this.name = 'VariableCategoryNotFoundError';
  }
}

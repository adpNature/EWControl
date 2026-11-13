/** docs/specs/23-categorias-variables-plc.md: nombre de categoría vacío o demasiado largo. */
export class InvalidVariableCategoryNameError extends Error {
  constructor(readonly maxLength: number) {
    super(`El nombre de la categoría debe tener entre 1 y ${maxLength} caracteres.`);
    this.name = 'InvalidVariableCategoryNameError';
  }
}

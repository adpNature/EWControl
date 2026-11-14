/** docs/specs/25-recetas.md, "Ediciones simultáneas": la `version` enviada ya no es la vigente. */
export class RecipeModifiedError extends Error {
  constructor(recipeId: string) {
    super(`Otra persona ha guardado cambios en la receta ${recipeId}.`);
    this.name = 'RecipeModifiedError';
  }
}

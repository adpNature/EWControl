/** docs/specs/25-recetas.md: una receta incompleta no se puede activar. */
export class RecipeIncompleteError extends Error {
  constructor(recipeId: string) {
    super(`La receta ${recipeId} está incompleta y no se puede activar.`);
    this.name = 'RecipeIncompleteError';
  }
}

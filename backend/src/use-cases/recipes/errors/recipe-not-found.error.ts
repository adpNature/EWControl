export class RecipeNotFoundError extends Error {
  constructor(recipeId: string) {
    super(`La receta ${recipeId} no existe.`);
    this.name = 'RecipeNotFoundError';
  }
}

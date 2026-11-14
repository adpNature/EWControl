export class RecipeLimitReachedError extends Error {
  constructor(maxRecipes: number) {
    super(`La Machine ya tiene el máximo de ${maxRecipes} recetas.`);
    this.name = 'RecipeLimitReachedError';
  }
}

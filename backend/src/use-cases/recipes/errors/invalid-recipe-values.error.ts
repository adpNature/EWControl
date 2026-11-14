import type { RecipeValueIssue } from '../../../entities/recipe.vo';

/** docs/specs/25-recetas.md, criterio backend 4: lleva todos los problemas, por variable. */
export class InvalidRecipeValuesError extends Error {
  constructor(readonly issues: RecipeValueIssue[]) {
    super('Los valores de la receta no son válidos.');
    this.name = 'InvalidRecipeValuesError';
  }
}

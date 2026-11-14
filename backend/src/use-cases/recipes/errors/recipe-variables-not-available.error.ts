/**
 * docs/specs/25-recetas.md: la Machine no tiene la categoría «Programación para
 * la receta» o ninguna de sus variables está mapeada con un tipo soportado.
 */
export class RecipeVariablesNotAvailableError extends Error {
  constructor(machineId: string) {
    super(`La Machine ${machineId} no tiene variables de receta.`);
    this.name = 'RecipeVariablesNotAvailableError';
  }
}

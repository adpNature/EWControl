/** docs/specs/26-receta-base.md, "Ediciones simultáneas": la `version` enviada ya no es la vigente. */
export class RecipeTemplateModifiedError extends Error {
  constructor(machineId: string) {
    super(`Otra persona ha guardado cambios en la receta base de la Machine ${machineId}.`);
    this.name = 'RecipeTemplateModifiedError';
  }
}

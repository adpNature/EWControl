/**
 * docs/specs/26-receta-base.md, "Configuración que deja de valer": la receta
 * base tiene valores fijos que faltan o ya no valen, así que no se puede activar
 * ninguna receta de la Machine hasta que un administrador la corrija.
 */
export class RecipeTemplateInvalidError extends Error {
  constructor(machineId: string) {
    super(`La receta base de la Machine ${machineId} tiene valores fijos que ya no son válidos.`);
    this.name = 'RecipeTemplateInvalidError';
  }
}

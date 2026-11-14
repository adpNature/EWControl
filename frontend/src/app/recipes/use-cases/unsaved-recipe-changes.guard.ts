import { CanDeactivateFn } from '@angular/router';

/** Página que puede tener cambios sin guardar. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * docs/specs/25-recetas.md, "Cambios sin guardar": salir del formulario con
 * cambios pide confirmación. Se usa el diálogo nativo del navegador, accesible
 * por teclado y lector de pantalla sin código propio.
 */
export const unsavedRecipeChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() ||
  window.confirm('Tienes cambios sin guardar en la receta. ¿Quieres salir sin guardarlos?');

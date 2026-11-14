import { Routes } from '@angular/router';
import { BreadcrumbCrumb } from '../shared/ui/breadcrumb/breadcrumb.model';
import { unsavedRecipeChangesGuard } from './use-cases/unsaved-recipe-changes.guard';

const recipesCrumb: BreadcrumbCrumb = { label: 'Recetas', link: () => ['/recetas'] };

/**
 * docs/specs/25-recetas.md: las recetas son de los tres roles (también el
 * `Operador`), así que viven fuera de `config`, como los paquetes (spec 20).
 */
export const recipesRoutes: Routes = [
  {
    path: '',
    data: { breadcrumb: [{ label: 'Recetas' }] satisfies BreadcrumbCrumb[] },
    loadComponent: () => import('./pages/recipes-page/recipes-page').then((m) => m.RecipesPage),
  },
  {
    // También para duplicar (`?duplicar=<id>`).
    path: ':machineId/nueva',
    data: { breadcrumb: [recipesCrumb, { label: 'Nueva' }] satisfies BreadcrumbCrumb[] },
    canDeactivate: [unsavedRecipeChangesGuard],
    loadComponent: () =>
      import('./pages/recipe-form-page/recipe-form-page').then((m) => m.RecipeFormPage),
  },
  {
    path: ':machineId/:recipeId',
    data: { breadcrumb: [recipesCrumb, { label: 'Editar' }] satisfies BreadcrumbCrumb[] },
    canDeactivate: [unsavedRecipeChangesGuard],
    loadComponent: () =>
      import('./pages/recipe-form-page/recipe-form-page').then((m) => m.RecipeFormPage),
  },
];

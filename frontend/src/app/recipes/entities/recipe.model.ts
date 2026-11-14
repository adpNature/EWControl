/** Entidades de docs/specs/25-recetas.md tal como las devuelve la API (docs/11-api-rest.md, "Recipes"). */
export type RecipeValue = number | boolean | string;

export interface RecipeValueEntry {
  signalVariableName: string;
  value: RecipeValue;
}

/** Variable de la categoría «Programación para la receta», en el orden de la GVL. */
export interface RecipeVariable {
  signalVariableName: string;
  dataType: string;
  comment: string | null;
  min: number | null;
  max: number | null;
}

export interface RecipeVariableSet {
  category: { id: string; name: string } | null;
  variables: RecipeVariable[];
  excludedCount: number;
}

export type RecipeValueIssueReason =
  'MISSING' | 'NOT_A_RECIPE_VARIABLE' | 'DUPLICATED' | 'TYPE_MISMATCH' | 'OUT_OF_RANGE';

export interface RecipeValueIssue {
  signalVariableName: string;
  reason: RecipeValueIssueReason;
  min?: number;
  max?: number;
}

export interface StaleRecipeValue extends RecipeValueEntry {
  reason: 'NOT_A_RECIPE_VARIABLE' | 'TYPE_MISMATCH' | 'OUT_OF_RANGE';
}

/** Fila del listado. */
export interface RecipeSummary {
  id: string;
  title: string;
  description: string | null;
  isActivated: boolean;
  activatedAt: string | null;
  isComplete: boolean;
  updatedAt: string;
  updatedByEmail: string;
}

export interface Recipe {
  id: string;
  machineId: string;
  title: string;
  description: string | null;
  values: RecipeValueEntry[];
  missingVariables: string[];
  staleValues: StaleRecipeValue[];
  isComplete: boolean;
  isActivated: boolean;
  activatedAt: string | null;
  activatedByEmail: string | null;
  version: number;
  createdAt: string;
  createdByEmail: string;
  updatedAt: string;
  updatedByEmail: string;
}

export interface RecipeRequest {
  title: string;
  description?: string | null;
  values: RecipeValueEntry[];
}

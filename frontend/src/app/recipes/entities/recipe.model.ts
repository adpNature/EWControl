import type { BooleanLabels, RecipeLayout, RecipeOption } from './recipe-template.model';

/**
 * Entidades de docs/specs/25-recetas.md, ampliadas por docs/specs/26-receta-base.md,
 * tal como las devuelve la API (docs/11-api-rest.md, "Recipe").
 */
export type RecipeValue = number | boolean | string;

export interface RecipeValueEntry {
  signalVariableName: string;
  value: RecipeValue;
}

/**
 * Variable de la categoría «Programación para la receta», en el orden de la
 * GVL, con las reglas efectivas de la receta base (spec 26: `min`/`max` ya
 * resueltos). Los campos opcionales faltan o son `null` si no se configuran.
 */
export interface RecipeVariable {
  signalVariableName: string;
  dataType: string;
  comment: string | null;
  min: number | null;
  max: number | null;
  /** `FIXED_VISIBLE` se muestra en solo lectura y no se guarda en la receta. */
  mode?: 'EDITABLE' | 'FIXED_VISIBLE';
  label?: string | null;
  helpText?: string | null;
  unit?: string | null;
  decimals?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  booleanLabels?: BooleanLabels | null;
  options?: RecipeOption[] | null;
  defaultValue?: RecipeValue | null;
  fixedValue?: RecipeValue | null;
}

/** Lo que necesita el formulario de recetas (`GET …/recipe-variables`). */
export interface RecipeVariableSet {
  category: { id: string; name: string } | null;
  /** Solo las visibles: editables y fijas visibles. */
  variables: RecipeVariable[];
  excludedCount: number;
  /** Disposición del formulario (spec 26). Sin ella, lista en el orden de la GVL. */
  layout?: RecipeLayout;
  /** Variables que no aparecen: fijas ocultas, ocultas y sin configurar. */
  hiddenCount?: number;
  /** `false` si algún valor fijo de la receta base ya no vale: no se puede activar. */
  isTemplateValid?: boolean;
}

export type RecipeValueIssueReason =
  | 'MISSING'
  | 'NOT_A_RECIPE_VARIABLE'
  | 'NOT_EDITABLE'
  | 'DUPLICATED'
  | 'TYPE_MISMATCH'
  | 'OUT_OF_RANGE'
  | 'NOT_AN_OPTION'
  | 'TOO_MANY_DECIMALS'
  | 'INVALID_LENGTH';

export interface RecipeValueIssue {
  signalVariableName: string;
  reason: RecipeValueIssueReason;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
}

export interface StaleRecipeValue extends RecipeValueEntry {
  reason: RecipeValueIssueReason;
}

/** Lo que llegaría a la máquina con esta receta (spec 26). */
export interface EffectiveRecipeValue extends RecipeValueEntry {
  source: 'RECIPE' | 'FIXED';
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
  /** Valores de variables que ya no son editables: se quitan al guardar (spec 26). */
  ignoredValues?: RecipeValueEntry[];
  /** `null` si la receta no está completa o la receta base no es válida. */
  effectiveValues?: EffectiveRecipeValue[] | null;
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

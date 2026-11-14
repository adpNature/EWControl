import { RecipeValue } from './recipe.model';

/**
 * Entidades de docs/specs/26-receta-base.md tal como las devuelve la API
 * (docs/11-api-rest.md, "Recipe").
 */
export type RecipeVariableMode = 'EDITABLE' | 'FIXED_VISIBLE' | 'FIXED_HIDDEN' | 'HIDDEN';

export interface RecipeOption {
  value: number;
  label: string;
}

export interface BooleanLabels {
  falseLabel: string;
  trueLabel: string;
}

/** Configuración de una variable en la receta base. `null` = sin configurar. */
export interface RecipeVariableConfig {
  mode: RecipeVariableMode;
  label: string | null;
  helpText: string | null;
  unit: string | null;
  decimals: number | null;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  booleanLabels: BooleanLabels | null;
  options: RecipeOption[] | null;
  defaultValue: RecipeValue | null;
  fixedValue: RecipeValue | null;
}

export type RecipeConfigField = Exclude<keyof RecipeVariableConfig, 'mode'>;

export type RecipeLayoutItemType = 'TITLE' | 'VARIABLE' | 'TEXT' | 'SPACER';

export interface RecipeLayoutItem {
  type: RecipeLayoutItemType;
  /** Ancho en columnas de 12: 3, 4, 6, 8, 9 o 12. */
  span: number;
  text?: string;
  signalVariableName?: string;
}

export interface RecipeLayout {
  rows: { items: RecipeLayoutItem[] }[];
}

/** Una variable de receta en la pantalla de la receta base. */
export interface RecipeTemplateVariable {
  signalVariableName: string;
  dataType: string;
  comment: string | null;
  mappingMin: number | null;
  mappingMax: number | null;
  isUnconfigured: boolean;
  suggestedOptions: RecipeOption[] | null;
  suggestedBooleanLabels: BooleanLabels | null;
  config: RecipeVariableConfig;
}

export interface StaleTemplateConfig {
  signalVariableName: string;
  field: RecipeConfigField;
  reason: string;
  rangeReason?: string;
  valueReason?: string;
}

export interface RecipeTemplate {
  category: { id: string; name: string } | null;
  isDefault: boolean;
  version: number;
  updatedAt: string | null;
  updatedByEmail: string | null;
  variables: RecipeTemplateVariable[];
  layout: RecipeLayout;
  removedVariables: string[];
  staleConfig: StaleTemplateConfig[];
  excludedCount: number;
}

export interface RecipeTemplateRequest {
  variables: (RecipeVariableConfig & { signalVariableName: string })[];
  layout: RecipeLayout;
}

export interface RecipeTemplateImpact {
  recipesBecomingIncomplete: number;
  activeRecipeBecomingIncomplete: { id: string; title: string } | null;
  examples: string[];
}

/** Problema devuelto por el Backend en `400 INVALID_RECIPE_TEMPLATE`. */
export interface RecipeTemplateIssue {
  signalVariableName?: string;
  field?: RecipeConfigField;
  row?: number;
  item?: number;
  reason: string;
  rangeReason?: string;
  valueReason?: string;
  min?: number;
  max?: number;
}

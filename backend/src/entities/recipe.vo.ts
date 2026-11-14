import { isOpcUaConnectionConfig, type ConnectionConfig } from './connection-config.vo';
import { WRITABLE_DATA_TYPES } from './connection-config.vo';
import type { VariableCatalogEntry } from './variable-catalog-entry.entity';
import type { VariableCategory } from './variable-category.entity';
import { validateWriteValue, type WriteValue } from './write-package.vo';

/**
 * Nombre fijo de la categoría de la GVL cuyas variables forman una receta
 * (docs/specs/25-recetas.md, "Modelo"). Se compara normalizado, así que vale
 * tanto «Programacion para la receta» (como llega del CSV) como con tilde.
 */
export const RECIPE_CATEGORY_NAME = 'Programación para la receta';

export const MAX_RECIPE_TITLE_LENGTH = 120;
export const MAX_RECIPE_DESCRIPTION_LENGTH = 500;
export const MAX_RECIPES_PER_MACHINE = 500;

export type RecipeValue = WriteValue;

export type RecipeValueEntry = { signalVariableName: string; value: RecipeValue };

/** Variable de receta: entrada del catálogo de la categoría de recetas, mapeada con tipo soportado. */
export type RecipeVariable = {
  signalVariableName: string;
  dataType: string;
  comment: string | null;
  min: number | null;
  max: number | null;
};

export type RecipeVariableSet = {
  category: { id: string; name: string } | null;
  variables: RecipeVariable[];
  /** Variables de la categoría que no aparecen en el formulario (sin mapear o de tipo no soportado). */
  excludedCount: number;
};

export type RecipeOption = { value: number; label: string };

/**
 * Reglas efectivas con las que se valida un valor de receta (spec 26, "Reglas
 * efectivas de un valor"): la variable con su `min`/`max` ya resueltos (receta
 * base → mapeo → tipo) y, si la receta base los configura, decimales, longitud
 * y opciones. Una `RecipeVariable` sin más configuración es un conjunto de reglas válido.
 */
export type RecipeValueRules = RecipeVariable & {
  decimals?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  options?: readonly RecipeOption[] | null;
};

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

/** Motivos por los que un valor concreto no cumple sus reglas. */
export type RecipeValueRuleReason =
  'TYPE_MISMATCH' | 'OUT_OF_RANGE' | 'NOT_AN_OPTION' | 'TOO_MANY_DECIMALS' | 'INVALID_LENGTH';

export type RecipeValueRuleIssue = {
  reason: RecipeValueRuleReason;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
};

export type RecipeValueIssue = Omit<RecipeValueRuleIssue, 'reason'> & {
  signalVariableName: string;
  reason: RecipeValueIssueReason;
};

export type StaleRecipeValue = RecipeValueEntry & { reason: RecipeValueRuleReason };

/** Estado de una receta guardada frente a las variables editables actuales. */
export type RecipeAssessment = {
  /** Valores válidos, en el orden de las variables de receta. */
  values: RecipeValueEntry[];
  missingVariables: string[];
  staleValues: StaleRecipeValue[];
  /**
   * Valores guardados de variables que ya no son editables (fijas, ocultas o que
   * han dejado de ser de receta). No dejan la receta incompleta (spec 26).
   */
  ignoredValues: RecipeValueEntry[];
  isComplete: boolean;
};

/**
 * Forma normalizada para comparar y buscar sin distinguir mayúsculas ni tildes
 * (spec 25: títulos únicos «Bobina A» = «bobina á», buscador, nombre de la categoría).
 */
export function normalizeForComparison(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Primera categoría (en orden de la GVL) cuyo nombre normalizado es el de la categoría de recetas. */
export function findRecipeCategory(
  categories: readonly VariableCategory[],
): VariableCategory | undefined {
  const target = normalizeForComparison(RECIPE_CATEGORY_NAME);
  return [...categories]
    .sort((a, b) => a.position - b.position)
    .find((category) => normalizeForComparison(category.name) === target);
}

/**
 * Variables de receta de una Machine (spec 25, criterio backend 1): las del
 * catálogo de la categoría de recetas que están en el `nodeMapping` con un
 * `dataType` escalar soportado, en el orden de la GVL.
 */
export function buildRecipeVariableSet(
  categories: readonly VariableCategory[],
  entries: readonly VariableCatalogEntry[],
  connectionConfig: ConnectionConfig | null,
): RecipeVariableSet {
  const category = findRecipeCategory(categories);
  if (!category) {
    return { category: null, variables: [], excludedCount: 0 };
  }
  const mappingByNodeId = new Map(
    connectionConfig && isOpcUaConnectionConfig(connectionConfig)
      ? connectionConfig.nodeMapping.map((entry) => [entry.nodeId, entry] as const)
      : [],
  );
  const categoryEntries = entries
    .filter((entry) => entry.categoryId === category.id)
    .sort((a, b) => a.position - b.position);
  const variables: RecipeVariable[] = [];
  const seen = new Set<string>();
  for (const entry of categoryEntries) {
    const mapping = mappingByNodeId.get(entry.nodeId);
    if (
      !mapping?.dataType ||
      !WRITABLE_DATA_TYPES.includes(mapping.dataType) ||
      seen.has(mapping.signalVariableName)
    ) {
      continue;
    }
    seen.add(mapping.signalVariableName);
    variables.push({
      signalVariableName: mapping.signalVariableName,
      dataType: mapping.dataType,
      comment: entry.comment,
      min: mapping.min ?? null,
      max: mapping.max ?? null,
    });
  }
  return {
    category: { id: category.id, name: category.name },
    variables,
    excludedCount: categoryEntries.length - variables.length,
  };
}

/**
 * Motivo por el que un valor no cumple sus reglas, o `null` si las cumple: tipo
 * (spec 25), rango efectivo y, si están configurados, opciones, decimales y
 * longitud (spec 26). Se usa para valores de receta, fijos y por defecto.
 */
export function recipeValueIssue(
  rules: RecipeValueRules,
  value: unknown,
): RecipeValueRuleIssue | null {
  if (!validateWriteValue({ dataType: rules.dataType }, value).ok) {
    return { reason: 'TYPE_MISMATCH' };
  }
  if (typeof value === 'number') {
    const belowMin = rules.min !== null && value < rules.min;
    const aboveMax = rules.max !== null && value > rules.max;
    if (belowMin || aboveMax) {
      return {
        reason: 'OUT_OF_RANGE',
        ...(rules.min !== null ? { min: rules.min } : {}),
        ...(rules.max !== null ? { max: rules.max } : {}),
      };
    }
    if (rules.options && !rules.options.some((option) => option.value === value)) {
      return { reason: 'NOT_AN_OPTION' };
    }
    if (rules.decimals != null && !hasAtMostDecimals(value, rules.decimals)) {
      return { reason: 'TOO_MANY_DECIMALS' };
    }
  }
  if (typeof value === 'string') {
    const tooShort = rules.minLength != null && value.length < rules.minLength;
    const tooLong = rules.maxLength != null && value.length > rules.maxLength;
    if (tooShort || tooLong) {
      return {
        reason: 'INVALID_LENGTH',
        ...(rules.minLength != null ? { minLength: rules.minLength } : {}),
        ...(rules.maxLength != null ? { maxLength: rules.maxLength } : {}),
      };
    }
  }
  return null;
}

/** `true` si `value` no tiene más de `decimals` decimales (tolerando la representación binaria). */
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const scaled = value * 10 ** decimals;
  return Math.abs(scaled - Math.round(scaled)) <= 1e-9 * Math.max(1, Math.abs(scaled));
}

/**
 * Valida los valores de una receta al crearla o editarla (spec 25, criterio
 * backend 4; spec 26, criterio backend 6): un valor válido para **cada**
 * variable editable, sin variables de más ni repetidas. Un valor de una variable
 * de receta que no es editable (fija u oculta) da `NOT_EDITABLE`. Devuelve todos
 * los problemas, no solo el primero.
 */
export function validateRecipeValues(
  values: readonly RecipeValueEntry[],
  rules: readonly RecipeValueRules[],
  nonEditableNames: ReadonlySet<string> = new Set(),
): RecipeValueIssue[] {
  const issues: RecipeValueIssue[] = [];
  const byName = new Map(rules.map((rule) => [rule.signalVariableName, rule]));
  const seen = new Set<string>();
  for (const { signalVariableName, value } of values) {
    if (seen.has(signalVariableName)) {
      issues.push({ signalVariableName, reason: 'DUPLICATED' });
      continue;
    }
    seen.add(signalVariableName);
    const rule = byName.get(signalVariableName);
    if (!rule) {
      issues.push({
        signalVariableName,
        reason: nonEditableNames.has(signalVariableName) ? 'NOT_EDITABLE' : 'NOT_A_RECIPE_VARIABLE',
      });
      continue;
    }
    const issue = recipeValueIssue(rule, value);
    if (issue) {
      issues.push({ signalVariableName, ...issue });
    }
  }
  for (const rule of rules) {
    if (!seen.has(rule.signalVariableName)) {
      issues.push({ signalVariableName: rule.signalVariableName, reason: 'MISSING' });
    }
  }
  return issues;
}

/**
 * Compara una receta guardada con las variables editables actuales (spec 25,
 * "Recetas que dejan de estar completas"; spec 26, "Valores de más"): separa los
 * valores válidos de los que ya no cumplen sus reglas (`staleValues`), lista las
 * variables sin valor y aparta, sin dejarla incompleta, los valores de variables
 * que ya no son editables (`ignoredValues`).
 */
export function assessRecipe(
  storedValues: readonly RecipeValueEntry[],
  rules: readonly RecipeValueRules[],
): RecipeAssessment {
  const stored = new Map(storedValues.map((entry) => [entry.signalVariableName, entry.value]));
  const values: RecipeValueEntry[] = [];
  const missingVariables: string[] = [];
  const staleValues: StaleRecipeValue[] = [];
  const known = new Set<string>();
  for (const rule of rules) {
    known.add(rule.signalVariableName);
    if (!stored.has(rule.signalVariableName)) {
      missingVariables.push(rule.signalVariableName);
      continue;
    }
    const value = stored.get(rule.signalVariableName) as RecipeValue;
    const issue = recipeValueIssue(rule, value);
    if (issue) {
      staleValues.push({
        signalVariableName: rule.signalVariableName,
        value,
        reason: issue.reason,
      });
      missingVariables.push(rule.signalVariableName);
    } else {
      values.push({ signalVariableName: rule.signalVariableName, value });
    }
  }
  return {
    values,
    missingVariables,
    staleValues,
    ignoredValues: storedValues.filter((entry) => !known.has(entry.signalVariableName)),
    isComplete: missingVariables.length === 0 && staleValues.length === 0,
  };
}

/** Texto en el que busca el buscador del listado: título y descripción normalizados. */
export function recipeSearchKey(title: string, description: string | null): string {
  return normalizeForComparison(`${title}\n${description ?? ''}`);
}

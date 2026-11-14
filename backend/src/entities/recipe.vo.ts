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

export type RecipeValueIssueReason =
  'MISSING' | 'NOT_A_RECIPE_VARIABLE' | 'DUPLICATED' | 'TYPE_MISMATCH' | 'OUT_OF_RANGE';

export type RecipeValueIssue = {
  signalVariableName: string;
  reason: RecipeValueIssueReason;
  min?: number;
  max?: number;
};

export type StaleRecipeValue = RecipeValueEntry & {
  reason: Exclude<RecipeValueIssueReason, 'MISSING' | 'DUPLICATED'>;
};

/** Estado de una receta guardada frente a las variables de receta actuales. */
export type RecipeAssessment = {
  /** Valores válidos, en el orden de las variables de receta. */
  values: RecipeValueEntry[];
  missingVariables: string[];
  staleValues: StaleRecipeValue[];
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

/** Motivo por el que un valor no es válido para su variable, o `null` si lo es. */
export function recipeValueIssue(
  variable: RecipeVariable,
  value: unknown,
): { reason: 'TYPE_MISMATCH' | 'OUT_OF_RANGE'; min?: number; max?: number } | null {
  if (!validateWriteValue({ dataType: variable.dataType }, value).ok) {
    return { reason: 'TYPE_MISMATCH' };
  }
  const numeric = value as number;
  const belowMin = variable.min !== null && numeric < variable.min;
  const aboveMax = variable.max !== null && numeric > variable.max;
  if (typeof value === 'number' && (belowMin || aboveMax)) {
    return {
      reason: 'OUT_OF_RANGE',
      ...(variable.min !== null ? { min: variable.min } : {}),
      ...(variable.max !== null ? { max: variable.max } : {}),
    };
  }
  return null;
}

/**
 * Valida los valores de una receta al crearla o editarla (spec 25, criterio
 * backend 4): un valor válido para **cada** variable de receta, sin variables de
 * más ni repetidas. Devuelve todos los problemas, no solo el primero.
 */
export function validateRecipeValues(
  values: readonly RecipeValueEntry[],
  variables: readonly RecipeVariable[],
): RecipeValueIssue[] {
  const issues: RecipeValueIssue[] = [];
  const byName = new Map(variables.map((variable) => [variable.signalVariableName, variable]));
  const seen = new Set<string>();
  for (const { signalVariableName, value } of values) {
    if (seen.has(signalVariableName)) {
      issues.push({ signalVariableName, reason: 'DUPLICATED' });
      continue;
    }
    seen.add(signalVariableName);
    const variable = byName.get(signalVariableName);
    if (!variable) {
      issues.push({ signalVariableName, reason: 'NOT_A_RECIPE_VARIABLE' });
      continue;
    }
    const issue = recipeValueIssue(variable, value);
    if (issue) {
      issues.push({ signalVariableName, ...issue });
    }
  }
  for (const variable of variables) {
    if (!seen.has(variable.signalVariableName)) {
      issues.push({ signalVariableName: variable.signalVariableName, reason: 'MISSING' });
    }
  }
  return issues;
}

/**
 * Compara una receta guardada con las variables de receta actuales (spec 25,
 * "Recetas que dejan de estar completas"): separa los valores que siguen siendo
 * válidos de los que ya no (`staleValues`) y lista las variables sin valor.
 */
export function assessRecipe(
  storedValues: readonly RecipeValueEntry[],
  variables: readonly RecipeVariable[],
): RecipeAssessment {
  const stored = new Map(storedValues.map((entry) => [entry.signalVariableName, entry.value]));
  const values: RecipeValueEntry[] = [];
  const missingVariables: string[] = [];
  const staleValues: StaleRecipeValue[] = [];
  const known = new Set<string>();
  for (const variable of variables) {
    known.add(variable.signalVariableName);
    if (!stored.has(variable.signalVariableName)) {
      missingVariables.push(variable.signalVariableName);
      continue;
    }
    const value = stored.get(variable.signalVariableName) as RecipeValue;
    const issue = recipeValueIssue(variable, value);
    if (issue) {
      staleValues.push({
        signalVariableName: variable.signalVariableName,
        value,
        reason: issue.reason,
      });
      missingVariables.push(variable.signalVariableName);
    } else {
      values.push({ signalVariableName: variable.signalVariableName, value });
    }
  }
  for (const entry of storedValues) {
    if (!known.has(entry.signalVariableName)) {
      staleValues.push({ ...entry, reason: 'NOT_A_RECIPE_VARIABLE' });
    }
  }
  return {
    values,
    missingVariables,
    staleValues,
    isComplete: missingVariables.length === 0 && staleValues.length === 0,
  };
}

/** Texto en el que busca el buscador del listado: título y descripción normalizados. */
export function recipeSearchKey(title: string, description: string | null): string {
  return normalizeForComparison(`${title}\n${description ?? ''}`);
}

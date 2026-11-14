import { ApiError } from '../../core/http/api-error.model';
import {
  parseInputValue,
  writeValueError,
} from '../../write-packages/use-cases/write-package-rules';
import {
  RecipeSummary,
  RecipeValue,
  RecipeValueIssue,
  RecipeVariable,
  StaleRecipeValue,
} from '../entities/recipe.model';

/**
 * Reglas de presentación de docs/specs/25-recetas.md. El Backend es la
 * autoridad final; aquí solo se evita enviar lo que seguro va a rechazar.
 * Tipos y límites se validan igual que los paquetes de escritura (spec 20).
 */
export const MAX_RECIPE_TITLE_LENGTH = 120;
export const MAX_RECIPE_DESCRIPTION_LENGTH = 500;
export const RECIPE_CATEGORY_NAME = 'Programación para la receta';

/**
 * Valor inicial de una variable en una receta nueva (spec 25): «No» en los
 * interruptores, texto vacío (que es un valor válido) en los `String` y sin
 * valor en los numéricos, que el usuario tiene que rellenar.
 */
export function initialValue(variable: RecipeVariable): RecipeValue | null {
  if (variable.dataType === 'Boolean') {
    return false;
  }
  return variable.dataType === 'String' ? '' : null;
}

/** Mensaje de error de un valor (todos son obligatorios), o `null` si es válido. */
export function recipeValueError(
  variable: RecipeVariable,
  value: RecipeValue | null,
): string | null {
  if (value === null || (typeof value === 'number' && Number.isNaN(value))) {
    return 'Obligatorio.';
  }
  return writeValueError(toLimits(variable), value);
}

/** Convierte lo escrito en un control al valor del tipo de la variable. */
export function parseRecipeInput(
  variable: RecipeVariable,
  raw: string | boolean,
): RecipeValue | null {
  return parseInputValue(variable.dataType, raw);
}

/** Título por defecto al duplicar, sin pasar del máximo. */
export function copyTitle(title: string): string {
  const suffix = ' (copia)';
  return `${title.slice(0, MAX_RECIPE_TITLE_LENGTH - suffix.length)}${suffix}`;
}

/** Texto de la columna «Estado» del listado. */
export function recipeStatusLabel(
  recipe: Pick<RecipeSummary, 'isActivated' | 'isComplete'>,
): string {
  const labels = [
    ...(recipe.isActivated ? ['Activa'] : []),
    ...(recipe.isComplete ? [] : ['Incompleta']),
  ];
  return labels.length > 0 ? labels.join(' · ') : '—';
}

const ISSUE_MESSAGES: ReadonlyMap<RecipeValueIssue['reason'], string> = new Map([
  ['MISSING', 'Obligatorio.'],
  ['NOT_A_RECIPE_VARIABLE', 'Ya no es una variable de la receta.'],
  ['DUPLICATED', 'Variable repetida.'],
  ['TYPE_MISMATCH', 'El valor no es válido para su tipo.'],
  ['OUT_OF_RANGE', 'Fuera de los límites permitidos.'],
]);

/** Mensaje de un problema de valor devuelto por el Backend (`400 INVALID_RECIPE_VALUES`). */
export function issueMessage(issue: RecipeValueIssue): string {
  if (issue.reason === 'OUT_OF_RANGE') {
    const limits = [
      ...(issue.min !== undefined ? [`mínimo ${issue.min}`] : []),
      ...(issue.max !== undefined ? [`máximo ${issue.max}`] : []),
    ];
    return limits.length > 0
      ? `Fuera de los límites (${limits.join(', ')}).`
      : (ISSUE_MESSAGES.get('OUT_OF_RANGE') as string);
  }
  return ISSUE_MESSAGES.get(issue.reason) ?? issue.reason;
}

/** Motivo legible por el que un valor guardado ya no se puede usar. */
export function staleValueMessage(stale: StaleRecipeValue): string {
  if (stale.reason === 'NOT_A_RECIPE_VARIABLE') {
    return `${stale.signalVariableName}: ya no es una variable de la receta.`;
  }
  return `${stale.signalVariableName}: el valor guardado (${String(stale.value)}) ya no es válido.`;
}

const API_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['RECIPE_TITLE_TAKEN', 'Ya existe una receta con ese título en esta máquina.'],
  ['RECIPE_MODIFIED', 'Otra persona ha guardado cambios en esta receta.'],
  ['RECIPE_INCOMPLETE', 'La receta está incompleta: complétala antes de activarla.'],
  ['RECIPE_LIMIT_REACHED', 'Esta máquina ya tiene el máximo de 500 recetas.'],
  [
    'RECIPE_VARIABLES_NOT_AVAILABLE',
    `Esta máquina no tiene la categoría «${RECIPE_CATEGORY_NAME}».`,
  ],
  ['INVALID_RECIPE_VALUES', 'Revisa los valores marcados.'],
  ['RECIPE_NOT_FOUND', 'La receta ya no existe.'],
  ['MACHINE_NOT_FOUND', 'La máquina no existe.'],
]);

/** Mensaje de un error de la API de recetas. */
export function recipeErrorMessage(error: ApiError): string {
  return API_ERROR_MESSAGES.get(error.code) ?? 'No se ha podido completar la operación.';
}

function toLimits(variable: RecipeVariable): { dataType: string; min?: number; max?: number } {
  return {
    dataType: variable.dataType,
    ...(variable.min !== null ? { min: variable.min } : {}),
    ...(variable.max !== null ? { max: variable.max } : {}),
  };
}

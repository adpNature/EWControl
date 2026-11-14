import { isNumericDataType } from './connection-config.vo';
import {
  assessRecipe,
  type RecipeOption,
  type RecipeValue,
  type RecipeValueEntry,
  recipeValueIssue,
  type RecipeValueRuleReason,
  type RecipeValueRules,
  type RecipeVariable,
} from './recipe.vo';
import { isIntegerDataType, numericTypeRange, validateWriteValue } from './write-package.vo';

/**
 * Receta base de una Machine (docs/specs/26-receta-base.md): qué variables de
 * receta aparecen en el formulario, cuáles tienen valor fijo, sus reglas y la
 * disposición del formulario. Todo lo de este fichero son funciones puras.
 */

export const RECIPE_VARIABLE_MODES = [
  'EDITABLE',
  'FIXED_VISIBLE',
  'FIXED_HIDDEN',
  'HIDDEN',
] as const;
export type RecipeVariableMode = (typeof RECIPE_VARIABLE_MODES)[number];

export const MAX_TEMPLATE_LABEL_LENGTH = 60;
export const MAX_TEMPLATE_HELP_TEXT_LENGTH = 300;
export const MAX_TEMPLATE_UNIT_LENGTH = 16;
export const MAX_TEMPLATE_DECIMALS = 6;
export const MAX_TEMPLATE_STRING_LENGTH = 256;
export const MAX_BOOLEAN_LABEL_LENGTH = 30;
export const MIN_TEMPLATE_OPTIONS = 2;
export const MAX_TEMPLATE_OPTIONS = 50;
export const MAX_OPTION_LABEL_LENGTH = 60;
export const MAX_LAYOUT_TITLE_LENGTH = 80;
export const MAX_LAYOUT_TEXT_LENGTH = 300;
export const MAX_LAYOUT_ROWS = 200;
export const LAYOUT_COLUMNS = 12;
/** Anchos permitidos en columnas: 25 %, 33 %, 50 %, 66 %, 75 % y 100 %. */
export const LAYOUT_SPANS: readonly number[] = [3, 4, 6, 8, 9, 12];
/** Ancho de cada variable en la receta base por defecto: tres por fila. */
const DEFAULT_SPAN = 4;

export type BooleanLabels = { falseLabel: string; trueLabel: string };

/** Configuración de una variable de receta. `null` = sin configurar. */
export type RecipeVariableConfig = {
  signalVariableName: string;
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
};

export type RecipeConfigField = Exclude<keyof RecipeVariableConfig, 'signalVariableName' | 'mode'>;

export type RecipeLayoutItem =
  | { type: 'TITLE' | 'TEXT'; span: number; text: string }
  | { type: 'VARIABLE'; span: number; signalVariableName: string }
  | { type: 'SPACER'; span: number };

export type RecipeLayoutItemType = RecipeLayoutItem['type'];
export const RECIPE_LAYOUT_ITEM_TYPES: readonly RecipeLayoutItemType[] = [
  'TITLE',
  'VARIABLE',
  'TEXT',
  'SPACER',
];

export type RecipeLayout = { rows: { items: RecipeLayoutItem[] }[] };

export type RecipeTemplateContent = {
  variables: RecipeVariableConfig[];
  layout: RecipeLayout;
};

export type RangeIssueReason =
  'MIN_GREATER_THAN_MAX' | 'OUT_OF_TYPE_RANGE' | 'OUT_OF_MAPPING_RANGE';

export type TemplateVariableIssueReason =
  | 'MISSING'
  | 'NOT_A_RECIPE_VARIABLE'
  | 'DUPLICATED'
  | 'NOT_APPLICABLE'
  | 'FIXED_VALUE_REQUIRED'
  | 'INVALID_RANGE'
  | 'INVALID_LENGTH'
  | 'INVALID_DECIMALS'
  | 'INVALID_OPTIONS'
  | 'INVALID_DEFAULT_VALUE'
  | 'INVALID_FIXED_VALUE';

export type TemplateVariableIssue = {
  signalVariableName: string;
  field?: RecipeConfigField;
  reason: TemplateVariableIssueReason;
  rangeReason?: RangeIssueReason;
  valueReason?: RecipeValueRuleReason;
  min?: number;
  max?: number;
};

export type TemplateLayoutIssueReason =
  | 'EMPTY_ROW'
  | 'ROW_TOO_WIDE'
  | 'INVALID_SPAN'
  | 'TOO_MANY_ROWS'
  | 'TEXT_REQUIRED'
  | 'TEXT_TOO_LONG'
  | 'VARIABLE_NOT_PLACED'
  | 'VARIABLE_NOT_VISIBLE'
  | 'VARIABLE_REPEATED';

export type TemplateLayoutIssue = {
  row?: number;
  item?: number;
  signalVariableName?: string;
  reason: TemplateLayoutIssueReason;
};

export type TemplateIssue = TemplateVariableIssue | TemplateLayoutIssue;

/** Configuración guardada que ya no vale con las variables actuales (spec 26). */
export type StaleTemplateConfig = {
  signalVariableName: string;
  field: RecipeConfigField;
  reason: TemplateVariableIssueReason;
  rangeReason?: RangeIssueReason;
  valueReason?: RecipeValueRuleReason;
};

const VISIBLE_MODES: readonly RecipeVariableMode[] = ['EDITABLE', 'FIXED_VISIBLE'];
const FIXED_MODES: readonly RecipeVariableMode[] = ['FIXED_VISIBLE', 'FIXED_HIDDEN'];

type FieldRule = {
  appliesToType: (dataType: string) => boolean;
  modes: readonly RecipeVariableMode[];
};

const ANY_TYPE = () => true;
const isRealType = (dataType: string) => dataType === 'Float' || dataType === 'Double';

/** A qué tipos y modos aplica cada campo (spec 26, tabla "Configuración de una variable"). */
const FIELD_RULES: Record<RecipeConfigField, FieldRule> = {
  label: { appliesToType: ANY_TYPE, modes: VISIBLE_MODES },
  helpText: { appliesToType: ANY_TYPE, modes: VISIBLE_MODES },
  unit: { appliesToType: isNumericDataType, modes: VISIBLE_MODES },
  decimals: { appliesToType: isRealType, modes: ['EDITABLE'] },
  min: { appliesToType: isNumericDataType, modes: ['EDITABLE'] },
  max: { appliesToType: isNumericDataType, modes: ['EDITABLE'] },
  minLength: { appliesToType: (dataType) => dataType === 'String', modes: ['EDITABLE'] },
  maxLength: { appliesToType: (dataType) => dataType === 'String', modes: ['EDITABLE'] },
  booleanLabels: { appliesToType: (dataType) => dataType === 'Boolean', modes: VISIBLE_MODES },
  options: { appliesToType: isIntegerDataType, modes: VISIBLE_MODES },
  defaultValue: { appliesToType: ANY_TYPE, modes: ['EDITABLE'] },
  fixedValue: { appliesToType: ANY_TYPE, modes: FIXED_MODES },
};

const CONFIG_FIELDS = Object.keys(FIELD_RULES) as RecipeConfigField[];

/** `true` si el modo hace que la variable aparezca en el formulario de recetas. */
export function isVisibleMode(mode: RecipeVariableMode): boolean {
  return VISIBLE_MODES.includes(mode);
}

/** `true` si el modo tiene valor fijo (llega a la receta activa desde la receta base). */
export function isFixedMode(mode: RecipeVariableMode): boolean {
  return FIXED_MODES.includes(mode);
}

/** `true` si el campo aplica al tipo y al modo de la variable. */
export function fieldApplies(
  field: RecipeConfigField,
  dataType: string,
  mode: RecipeVariableMode,
): boolean {
  const rule = FIELD_RULES[field];
  return rule.appliesToType(dataType) && rule.modes.includes(mode);
}

/** Configuración vacía (todo sin configurar) con el modo indicado. */
export function blankVariableConfig(
  signalVariableName: string,
  mode: RecipeVariableMode,
): RecipeVariableConfig {
  return {
    signalVariableName,
    mode,
    label: null,
    helpText: null,
    unit: null,
    decimals: null,
    min: null,
    max: null,
    minLength: null,
    maxLength: null,
    booleanLabels: null,
    options: null,
    defaultValue: null,
    fixedValue: null,
  };
}

/**
 * Receta base por defecto (spec 26, "Receta base por defecto"): todas las
 * variables editables, sin más configuración, en filas de tres al 33 % en el
 * orden de la GVL. Reproduce el comportamiento de la spec 25.
 */
export function defaultTemplateContent(
  variables: readonly RecipeVariable[],
): RecipeTemplateContent {
  return {
    variables: variables.map((variable) =>
      blankVariableConfig(variable.signalVariableName, 'EDITABLE'),
    ),
    layout: {
      rows: chunkVariablesIntoRows(variables.map((variable) => variable.signalVariableName)),
    },
  };
}

function chunkVariablesIntoRows(names: readonly string[]): RecipeLayout['rows'] {
  const perRow = LAYOUT_COLUMNS / DEFAULT_SPAN;
  const rows: RecipeLayout['rows'] = [];
  for (let index = 0; index < names.length; index += perRow) {
    rows.push({
      items: names.slice(index, index + perRow).map((signalVariableName) => ({
        type: 'VARIABLE' as const,
        span: DEFAULT_SPAN,
        signalVariableName,
      })),
    });
  }
  return rows;
}

/**
 * Reglas efectivas de una variable con su configuración (spec 26, "Reglas
 * efectivas"): `min`/`max` de la receta base si aplican, si no los del mapeo;
 * decimales, longitud y opciones solo si aplican a su tipo y modo.
 */
export function effectiveRules(
  variable: RecipeVariable,
  config: RecipeVariableConfig,
): RecipeValueRules {
  const applies = (field: RecipeConfigField) =>
    config[field] !== null && fieldApplies(field, variable.dataType, config.mode);
  return {
    ...variable,
    min: applies('min') ? config.min : variable.min,
    max: applies('max') ? config.max : variable.max,
    decimals: applies('decimals') ? config.decimals : null,
    minLength: applies('minLength') ? config.minLength : null,
    maxLength: applies('maxLength') ? config.maxLength : null,
    options: applies('options') ? config.options : null,
  };
}

type Inspection = { issues: TemplateVariableIssue[]; sanitized: RecipeVariableConfig };

/**
 * Revisa la configuración de una variable contra su tipo, su mapeo y su modo.
 * Devuelve todos los problemas y una versión saneada sin los campos que fallan
 * (salvo `fixedValue`, que se conserva porque ignorarlo cambiaría lo que llega
 * a la máquina). La validación al guardar usa `issues`; la lectura de una
 * receta base guardada usa `sanitized` y los convierte en `staleConfig`.
 */
export function inspectVariableConfig(
  config: RecipeVariableConfig,
  variable: RecipeVariable,
): Inspection {
  const name = variable.signalVariableName;
  const issues: TemplateVariableIssue[] = [];
  const sanitized: RecipeVariableConfig = { ...config };
  const drop = (
    field: RecipeConfigField,
    issue: Omit<TemplateVariableIssue, 'signalVariableName' | 'field'>,
  ) => {
    issues.push({ signalVariableName: name, field, ...issue });
    (sanitized as Record<RecipeConfigField, unknown>)[field] = null;
  };

  for (const field of CONFIG_FIELDS) {
    if (sanitized[field] !== null && !fieldApplies(field, variable.dataType, config.mode)) {
      drop(field, { reason: 'NOT_APPLICABLE' });
    }
  }

  inspectRange(sanitized, variable, drop);
  inspectLengthAndDecimals(sanitized, drop);
  if (sanitized.options !== null) {
    const rules = effectiveRules(variable, { ...sanitized, options: null });
    if (!optionsAreValid(sanitized.options, rules)) {
      drop('options', { reason: 'INVALID_OPTIONS' });
    }
  }

  const rules = effectiveRules(variable, sanitized);
  if (sanitized.defaultValue !== null) {
    const issue = recipeValueIssue(rules, sanitized.defaultValue);
    if (issue) {
      drop('defaultValue', { reason: 'INVALID_DEFAULT_VALUE', valueReason: issue.reason });
    }
  }
  if (isFixedMode(config.mode)) {
    if (sanitized.fixedValue === null) {
      issues.push({
        signalVariableName: name,
        field: 'fixedValue',
        reason: 'FIXED_VALUE_REQUIRED',
      });
    } else {
      const issue = recipeValueIssue(rules, sanitized.fixedValue);
      if (issue) {
        issues.push({
          signalVariableName: name,
          field: 'fixedValue',
          reason: 'INVALID_FIXED_VALUE',
          valueReason: issue.reason,
        });
      }
    }
  }
  return { issues, sanitized };
}

type Drop = (
  field: RecipeConfigField,
  issue: Omit<TemplateVariableIssue, 'signalVariableName' | 'field'>,
) => void;

function inspectRange(config: RecipeVariableConfig, variable: RecipeVariable, drop: Drop): void {
  for (const field of ['min', 'max'] as const) {
    const value = config[field];
    if (value === null) {
      continue;
    }
    const typeRange = numericTypeRange(variable.dataType);
    if (!validateWriteValue({ dataType: variable.dataType }, value).ok) {
      drop(field, {
        reason: 'INVALID_RANGE',
        rangeReason: 'OUT_OF_TYPE_RANGE',
        ...(typeRange ? { min: typeRange[0], max: typeRange[1] } : {}),
      });
      continue;
    }
    const belowMapping = variable.min !== null && value < variable.min;
    const aboveMapping = variable.max !== null && value > variable.max;
    if (belowMapping || aboveMapping) {
      drop(field, {
        reason: 'INVALID_RANGE',
        rangeReason: 'OUT_OF_MAPPING_RANGE',
        ...(variable.min !== null ? { min: variable.min } : {}),
        ...(variable.max !== null ? { max: variable.max } : {}),
      });
    }
  }
  if (config.min !== null && config.max !== null && config.min > config.max) {
    drop('max', { reason: 'INVALID_RANGE', rangeReason: 'MIN_GREATER_THAN_MAX' });
  }
}

function inspectLengthAndDecimals(config: RecipeVariableConfig, drop: Drop): void {
  const isLength = (value: number | null) =>
    value === null ||
    (Number.isInteger(value) && value >= 0 && value <= MAX_TEMPLATE_STRING_LENGTH);
  if (!isLength(config.minLength)) {
    drop('minLength', { reason: 'INVALID_LENGTH' });
  }
  if (!isLength(config.maxLength)) {
    drop('maxLength', { reason: 'INVALID_LENGTH' });
  }
  if (
    config.minLength !== null &&
    config.maxLength !== null &&
    config.minLength > config.maxLength
  ) {
    drop('maxLength', { reason: 'INVALID_LENGTH' });
  }
  const decimals = config.decimals;
  if (
    decimals !== null &&
    !(Number.isInteger(decimals) && decimals >= 0 && decimals <= MAX_TEMPLATE_DECIMALS)
  ) {
    drop('decimals', { reason: 'INVALID_DECIMALS' });
  }
}

function optionsAreValid(options: readonly RecipeOption[], rules: RecipeValueRules): boolean {
  if (options.length < MIN_TEMPLATE_OPTIONS || options.length > MAX_TEMPLATE_OPTIONS) {
    return false;
  }
  const values = new Set(options.map((option) => option.value));
  return (
    values.size === options.length &&
    options.every(
      (option) => option.label.trim().length > 0 && recipeValueIssue(rules, option.value) === null,
    )
  );
}

/**
 * Valida una receta base completa antes de guardarla (spec 26, criterio
 * backend 2): una configuración por cada variable de receta actual, sin
 * variables de más ni repetidas, y una disposición válida. Devuelve todos los problemas.
 */
export function validateTemplateContent(
  content: RecipeTemplateContent,
  variables: readonly RecipeVariable[],
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const byName = new Map(variables.map((variable) => [variable.signalVariableName, variable]));
  const seen = new Set<string>();
  for (const config of content.variables) {
    const variable = byName.get(config.signalVariableName);
    if (seen.has(config.signalVariableName)) {
      issues.push({ signalVariableName: config.signalVariableName, reason: 'DUPLICATED' });
      continue;
    }
    seen.add(config.signalVariableName);
    if (!variable) {
      issues.push({
        signalVariableName: config.signalVariableName,
        reason: 'NOT_A_RECIPE_VARIABLE',
      });
      continue;
    }
    issues.push(...inspectVariableConfig(config, variable).issues);
  }
  for (const variable of variables) {
    if (!seen.has(variable.signalVariableName)) {
      issues.push({ signalVariableName: variable.signalVariableName, reason: 'MISSING' });
    }
  }
  const visible = content.variables
    .filter((config) => byName.has(config.signalVariableName) && isVisibleMode(config.mode))
    .map((config) => config.signalVariableName);
  issues.push(...validateLayout(content.layout, visible));
  return issues;
}

/**
 * Valida la disposición (spec 26, "Disposición"): filas no vacías de como mucho
 * 12 columnas con anchos permitidos, textos obligatorios en títulos y textos, y
 * cada variable visible colocada exactamente una vez (y ninguna otra).
 */
export function validateLayout(
  layout: RecipeLayout,
  visibleNames: readonly string[],
): TemplateLayoutIssue[] {
  const issues: TemplateLayoutIssue[] = [];
  if (layout.rows.length > MAX_LAYOUT_ROWS) {
    issues.push({ reason: 'TOO_MANY_ROWS' });
  }
  const visible = new Set(visibleNames);
  const placed = new Set<string>();
  layout.rows.forEach((row, rowIndex) => {
    if (row.items.length === 0) {
      issues.push({ row: rowIndex, reason: 'EMPTY_ROW' });
      return;
    }
    let width = 0;
    row.items.forEach((item, itemIndex) => {
      const at = { row: rowIndex, item: itemIndex };
      if (!LAYOUT_SPANS.includes(item.span)) {
        issues.push({ ...at, reason: 'INVALID_SPAN' });
      }
      width += item.span;
      if (item.type === 'TITLE' || item.type === 'TEXT') {
        const limit = item.type === 'TITLE' ? MAX_LAYOUT_TITLE_LENGTH : MAX_LAYOUT_TEXT_LENGTH;
        if (!item.text?.trim()) {
          issues.push({ ...at, reason: 'TEXT_REQUIRED' });
        } else if (item.text.trim().length > limit) {
          issues.push({ ...at, reason: 'TEXT_TOO_LONG' });
        }
      }
      if (item.type === 'VARIABLE') {
        const name = item.signalVariableName;
        if (!visible.has(name)) {
          issues.push({ ...at, signalVariableName: name, reason: 'VARIABLE_NOT_VISIBLE' });
        } else if (placed.has(name)) {
          issues.push({ ...at, signalVariableName: name, reason: 'VARIABLE_REPEATED' });
        }
        placed.add(name);
      }
    });
    if (width > LAYOUT_COLUMNS) {
      issues.push({ row: rowIndex, reason: 'ROW_TOO_WIDE' });
    }
  });
  for (const name of visibleNames) {
    if (!placed.has(name)) {
      issues.push({ signalVariableName: name, reason: 'VARIABLE_NOT_PLACED' });
    }
  }
  return issues;
}

/** Receta base aplicada a las variables actuales: lo que de verdad está en vigor. */
export type ResolvedRecipeTemplate = {
  isDefault: boolean;
  /** Configuración en vigor por variable, en el orden de la GVL (sin la que ya no vale). */
  configs: RecipeVariableConfig[];
  /** Variables nuevas, sin configurar: cuentan como `HIDDEN`. */
  unconfiguredVariables: string[];
  /** Variables configuradas que ya no son de receta. */
  removedVariables: string[];
  staleConfig: StaleTemplateConfig[];
  /** Disposición sin elementos de variables que ya no son visibles. */
  layout: RecipeLayout;
  /** `false` si algún valor fijo falta o ya no vale: bloquea la activación. */
  isValid: boolean;
  /** Reglas de las variables `EDITABLE`, en el orden de la GVL. */
  editableRules: RecipeValueRules[];
  /** Variables de receta que no son editables (fijas u ocultas). */
  nonEditableNames: Set<string>;
  /** Valores fijos en vigor, en el orden de la GVL (solo si son válidos). */
  fixedValues: RecipeValueEntry[];
};

/**
 * Aplica una receta base guardada (o la por defecto si no hay) a las variables
 * de receta actuales (spec 26, "Variables nuevas", "Variables que desaparecen"
 * y "Configuración que deja de valer").
 */
export function resolveRecipeTemplate(
  stored: RecipeTemplateContent | null,
  variables: readonly RecipeVariable[],
): ResolvedRecipeTemplate {
  const content = stored ?? defaultTemplateContent(variables);
  const storedByName = new Map(
    content.variables.map((config) => [config.signalVariableName, config]),
  );
  const currentNames = new Set(variables.map((variable) => variable.signalVariableName));
  const configs: RecipeVariableConfig[] = [];
  const unconfiguredVariables: string[] = [];
  const staleConfig: StaleTemplateConfig[] = [];
  const editableRules: RecipeValueRules[] = [];
  const nonEditableNames = new Set<string>();
  const fixedValues: RecipeValueEntry[] = [];
  let isValid = true;

  for (const variable of variables) {
    const storedConfig = storedByName.get(variable.signalVariableName);
    if (!storedConfig) {
      unconfiguredVariables.push(variable.signalVariableName);
      configs.push(blankVariableConfig(variable.signalVariableName, 'HIDDEN'));
      nonEditableNames.add(variable.signalVariableName);
      continue;
    }
    const { issues, sanitized } = inspectVariableConfig(storedConfig, variable);
    for (const issue of issues) {
      if (issue.field) {
        staleConfig.push({
          signalVariableName: issue.signalVariableName,
          field: issue.field,
          reason: issue.reason,
          ...(issue.rangeReason ? { rangeReason: issue.rangeReason } : {}),
          ...(issue.valueReason ? { valueReason: issue.valueReason } : {}),
        });
      }
    }
    const fixedIsValid = !issues.some((issue) => issue.field === 'fixedValue');
    configs.push(sanitized);
    if (sanitized.mode === 'EDITABLE') {
      editableRules.push(effectiveRules(variable, sanitized));
    } else {
      nonEditableNames.add(variable.signalVariableName);
    }
    if (isFixedMode(sanitized.mode)) {
      if (fixedIsValid) {
        fixedValues.push({
          signalVariableName: variable.signalVariableName,
          value: sanitized.fixedValue as RecipeValue,
        });
      } else {
        isValid = false;
      }
    }
  }

  const visible = configs
    .filter((config) => isVisibleMode(config.mode))
    .map((config) => config.signalVariableName);
  return {
    isDefault: stored === null,
    configs,
    unconfiguredVariables,
    removedVariables: content.variables
      .map((config) => config.signalVariableName)
      .filter((name) => !currentNames.has(name)),
    staleConfig,
    layout: cleanLayout(content.layout, visible),
    isValid,
    editableRules,
    nonEditableNames,
    fixedValues,
  };
}

/**
 * Quita de la disposición los elementos de variables que ya no son visibles y
 * las filas que se quedan vacías, y añade al final las visibles que falten (no
 * debería ocurrir con una receta base guardada, pero así ninguna se pierde).
 */
function cleanLayout(layout: RecipeLayout, visibleNames: readonly string[]): RecipeLayout {
  const visible = new Set(visibleNames);
  const placed = new Set<string>();
  const rows = layout.rows
    .map((row) => ({
      items: row.items.filter((item) => {
        if (item.type !== 'VARIABLE') {
          return true;
        }
        if (!visible.has(item.signalVariableName) || placed.has(item.signalVariableName)) {
          return false;
        }
        placed.add(item.signalVariableName);
        return true;
      }),
    }))
    .filter((row) => row.items.some((item) => item.type !== 'SPACER'));
  const unplaced = visibleNames.filter((name) => !placed.has(name));
  return { rows: [...rows, ...chunkVariablesIntoRows(unplaced)] };
}

/** Propuesta leída del comentario de la GVL (spec 26, "Consultar la receta base"). */
export type CommentSuggestion = {
  options: RecipeOption[] | null;
  booleanLabels: BooleanLabels | null;
};

const OPTION_PAIR = /^\s*(-?\d+)\s*[-–—=:]\s*(.+?)\s*$/;

/**
 * Lee del comentario de la GVL una lista de opciones cuando sigue el patrón
 * «N opciones: 0 - Texto / 1 - Texto…». Para enteros propone opciones (que
 * caben en el tipo); para `Boolean` con exactamente 0 y 1, los textos de
 * `false`/`true`. Cualquier otra cosa no propone nada.
 */
export function suggestFromComment(comment: string | null, dataType: string): CommentSuggestion {
  const none: CommentSuggestion = { options: null, booleanLabels: null };
  if (!comment) {
    return none;
  }
  const text = comment.normalize('NFC');
  const marker = /opci[oó]n(es)?\s*:/i.exec(text);
  if (!marker) {
    return none;
  }
  const parts = text
    .slice(marker.index + marker[0].length)
    .split(/[/\n;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const options: RecipeOption[] = [];
  for (const part of parts) {
    const match = OPTION_PAIR.exec(part);
    if (!match) {
      return none;
    }
    options.push({ value: Number(match[1]), label: match[2].slice(0, MAX_OPTION_LABEL_LENGTH) });
  }
  if (
    options.length < MIN_TEMPLATE_OPTIONS ||
    new Set(options.map((option) => option.value)).size !== options.length
  ) {
    return none;
  }
  if (dataType === 'Boolean') {
    const falseOption = options.find((option) => option.value === 0);
    const trueOption = options.find((option) => option.value === 1);
    return options.length === 2 && falseOption && trueOption
      ? {
          options: null,
          booleanLabels: {
            falseLabel: falseOption.label.slice(0, MAX_BOOLEAN_LABEL_LENGTH),
            trueLabel: trueOption.label.slice(0, MAX_BOOLEAN_LABEL_LENGTH),
          },
        }
      : none;
  }
  if (!isIntegerDataType(dataType) || options.length > MAX_TEMPLATE_OPTIONS) {
    return none;
  }
  const fits = options.every((option) => validateWriteValue({ dataType }, option.value).ok);
  return fits ? { options, booleanLabels: null } : none;
}

/** Resultado de `POST …/recipe-template/impact` (spec 26). */
export type TemplateImpact = {
  recipesBecomingIncomplete: number;
  activeRecipeBecomingIncomplete: { id: string; title: string } | null;
  examples: string[];
};

const MAX_IMPACT_EXAMPLES = 10;

/**
 * Recetas que hoy están completas y con la receta base propuesta no lo
 * estarían (spec 26, criterio backend 4). Las recetas ya incompletas no cuentan.
 */
export function computeTemplateImpact(
  recipes: readonly {
    id: string;
    title: string;
    isActivated: boolean;
    values: RecipeValueEntry[];
  }[],
  currentRules: readonly RecipeValueRules[],
  proposedRules: readonly RecipeValueRules[],
): TemplateImpact {
  const affected = recipes.filter(
    (recipe) =>
      assessRecipe(recipe.values, currentRules).isComplete &&
      !assessRecipe(recipe.values, proposedRules).isComplete,
  );
  const active = affected.find((recipe) => recipe.isActivated);
  return {
    recipesBecomingIncomplete: affected.length,
    activeRecipeBecomingIncomplete: active ? { id: active.id, title: active.title } : null,
    examples: affected.slice(0, MAX_IMPACT_EXAMPLES).map((recipe) => recipe.title),
  };
}

/** Variable tal como se pinta en el formulario de recetas (spec 26, `GET …/recipe-variables`). */
export type RecipeFormVariable = RecipeVariable & {
  mode: 'EDITABLE' | 'FIXED_VISIBLE';
  label: string | null;
  helpText: string | null;
  unit: string | null;
  decimals: number | null;
  minLength: number | null;
  maxLength: number | null;
  booleanLabels: BooleanLabels | null;
  options: RecipeOption[] | null;
  defaultValue: RecipeValue | null;
  fixedValue: RecipeValue | null;
};

export type RecipeFormDefinition = {
  category: { id: string; name: string } | null;
  /** Solo las visibles (`EDITABLE` y `FIXED_VISIBLE`), en el orden de la GVL, con reglas efectivas. */
  variables: RecipeFormVariable[];
  layout: RecipeLayout;
  excludedCount: number;
  /** Variables que no aparecen: fijas ocultas, ocultas y sin configurar. */
  hiddenCount: number;
  isTemplateValid: boolean;
};

/**
 * Lo que necesita el formulario de recetas (spec 26, criterio backend 10): las
 * variables visibles con sus reglas efectivas y la disposición. Los valores de
 * las `FIXED_HIDDEN` no salen de aquí.
 */
export function buildRecipeForm(
  set: {
    category: { id: string; name: string } | null;
    variables: RecipeVariable[];
    excludedCount: number;
  },
  template: ResolvedRecipeTemplate,
): RecipeFormDefinition {
  const configs = new Map(template.configs.map((config) => [config.signalVariableName, config]));
  const variables: RecipeFormVariable[] = [];
  for (const variable of set.variables) {
    const config = configs.get(variable.signalVariableName);
    if (!config || (config.mode !== 'EDITABLE' && config.mode !== 'FIXED_VISIBLE')) {
      continue;
    }
    const rules = effectiveRules(variable, config);
    variables.push({
      ...variable,
      min: rules.min,
      max: rules.max,
      mode: config.mode,
      label: config.label,
      helpText: config.helpText,
      unit: config.unit,
      decimals: rules.decimals ?? null,
      minLength: rules.minLength ?? null,
      maxLength: rules.maxLength ?? null,
      booleanLabels: config.booleanLabels,
      options: config.options,
      defaultValue: config.mode === 'EDITABLE' ? config.defaultValue : null,
      fixedValue: config.mode === 'FIXED_VISIBLE' ? config.fixedValue : null,
    });
  }
  return {
    category: set.category,
    variables,
    layout: template.layout,
    excludedCount: set.excludedCount,
    hiddenCount: set.variables.length - variables.length,
    isTemplateValid: template.isValid,
  };
}

export type EffectiveRecipeValue = RecipeValueEntry & { source: 'RECIPE' | 'FIXED' };

/**
 * Lo que llegaría a la máquina con esta receta (spec 26, "Lo que llega a la
 * receta activa"): valores editables de la receta más los valores fijos de la
 * receta base, en el orden de la GVL. `null` si la receta no está completa o la
 * receta base no es válida.
 */
export function effectiveRecipeValues(
  variables: readonly RecipeVariable[],
  recipeValues: readonly RecipeValueEntry[],
  isComplete: boolean,
  template: ResolvedRecipeTemplate,
): EffectiveRecipeValue[] | null {
  if (!isComplete || !template.isValid) {
    return null;
  }
  const fromRecipe = new Map(recipeValues.map((entry) => [entry.signalVariableName, entry.value]));
  const fixed = new Map(
    template.fixedValues.map((entry) => [entry.signalVariableName, entry.value]),
  );
  const result: EffectiveRecipeValue[] = [];
  for (const { signalVariableName } of variables) {
    if (fromRecipe.has(signalVariableName)) {
      result.push({
        signalVariableName,
        value: fromRecipe.get(signalVariableName) as RecipeValue,
        source: 'RECIPE',
      });
    } else if (fixed.has(signalVariableName)) {
      result.push({
        signalVariableName,
        value: fixed.get(signalVariableName) as RecipeValue,
        source: 'FIXED',
      });
    }
  }
  return result;
}

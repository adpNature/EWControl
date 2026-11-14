import { ApiError } from '../../core/http/api-error.model';
import { writeValueError } from '../../write-packages/use-cases/write-package-rules';
import {
  RecipeConfigField,
  RecipeLayout,
  RecipeLayoutItem,
  RecipeLayoutItemType,
  RecipeTemplateImpact,
  RecipeTemplateIssue,
  RecipeTemplateRequest,
  RecipeTemplateVariable,
  RecipeVariableConfig,
  RecipeVariableMode,
  StaleTemplateConfig,
} from '../entities/recipe-template.model';
import { RecipeValue, RecipeVariable, RecipeVariableSet } from '../entities/recipe.model';
import { recipeValueError, variableLabel } from './recipe-rules';

/**
 * Reglas de presentación del editor de la receta base
 * (docs/specs/26-receta-base.md). Reflejan las del Backend para avisar antes de
 * guardar; el Backend sigue siendo la autoridad final.
 */

export const LAYOUT_COLUMNS = 12;
export const MAX_LAYOUT_TITLE_LENGTH = 80;
export const MAX_LAYOUT_TEXT_LENGTH = 300;
export const MAX_TEMPLATE_DECIMALS = 6;
export const MAX_TEMPLATE_STRING_LENGTH = 256;
export const MIN_TEMPLATE_OPTIONS = 2;
export const MAX_TEMPLATE_OPTIONS = 50;
/** Ancho con el que se coloca una variable que pasa a ser visible: tres por fila. */
const NEW_VARIABLE_SPAN = 4;

export const SPAN_OPTIONS: readonly { span: number; label: string }[] = [
  { span: 3, label: '25 %' },
  { span: 4, label: '33 %' },
  { span: 6, label: '50 %' },
  { span: 8, label: '66 %' },
  { span: 9, label: '75 %' },
  { span: 12, label: '100 %' },
];

export const MODE_OPTIONS: readonly {
  mode: RecipeVariableMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'EDITABLE',
    label: 'Editable',
    description: 'Quien crea la receta pone el valor.',
  },
  {
    mode: 'FIXED_VISIBLE',
    label: 'Fija y visible',
    description: 'Se ve en el formulario, pero no se puede cambiar.',
  },
  {
    mode: 'FIXED_HIDDEN',
    label: 'Fija y oculta',
    description: 'No se ve, pero su valor fijo llega a la máquina.',
  },
  {
    mode: 'HIDDEN',
    label: 'Oculta',
    description: 'No se ve ni llega a la máquina.',
  },
];

export function modeLabel(mode: RecipeVariableMode): string {
  return MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? mode;
}

export function spanLabel(span: number): string {
  return SPAN_OPTIONS.find((option) => option.span === span)?.label ?? `${span}/12`;
}

export function isVisibleMode(mode: RecipeVariableMode): boolean {
  return mode === 'EDITABLE' || mode === 'FIXED_VISIBLE';
}

export function isFixedMode(mode: RecipeVariableMode): boolean {
  return mode === 'FIXED_VISIBLE' || mode === 'FIXED_HIDDEN';
}

const INTEGER_TYPES = ['SByte', 'Byte', 'Int16', 'UInt16', 'Int32', 'UInt32'];
const REAL_TYPES = ['Float', 'Double'];

export function isIntegerType(dataType: string): boolean {
  return INTEGER_TYPES.includes(dataType);
}

export function isNumericType(dataType: string): boolean {
  return isIntegerType(dataType) || REAL_TYPES.includes(dataType);
}

/** Nombre legible del tipo OPC UA para el administrador. */
export function dataTypeLabel(dataType: string): string {
  if (dataType === 'Boolean') {
    return 'Sí / No';
  }
  if (dataType === 'String') {
    return 'Texto';
  }
  if (isIntegerType(dataType)) {
    return `Entero (${dataType})`;
  }
  return REAL_TYPES.includes(dataType) ? `Decimal (${dataType})` : dataType;
}

const VISIBLE: readonly RecipeVariableMode[] = ['EDITABLE', 'FIXED_VISIBLE'];
const FIXED: readonly RecipeVariableMode[] = ['FIXED_VISIBLE', 'FIXED_HIDDEN'];
const ANY = () => true;

/** A qué tipos y modos aplica cada campo (spec 26, tabla "Configuración de una variable"). */
const FIELD_RULES: Record<
  RecipeConfigField,
  { type: (dataType: string) => boolean; modes: readonly RecipeVariableMode[] }
> = {
  label: { type: ANY, modes: VISIBLE },
  helpText: { type: ANY, modes: VISIBLE },
  unit: { type: isNumericType, modes: VISIBLE },
  decimals: { type: (dataType) => REAL_TYPES.includes(dataType), modes: ['EDITABLE'] },
  min: { type: isNumericType, modes: ['EDITABLE'] },
  max: { type: isNumericType, modes: ['EDITABLE'] },
  minLength: { type: (dataType) => dataType === 'String', modes: ['EDITABLE'] },
  maxLength: { type: (dataType) => dataType === 'String', modes: ['EDITABLE'] },
  booleanLabels: { type: (dataType) => dataType === 'Boolean', modes: VISIBLE },
  options: { type: isIntegerType, modes: VISIBLE },
  defaultValue: { type: ANY, modes: ['EDITABLE'] },
  fixedValue: { type: ANY, modes: FIXED },
};

const CONFIG_FIELDS = Object.keys(FIELD_RULES) as RecipeConfigField[];

export function fieldApplies(
  field: RecipeConfigField,
  dataType: string,
  mode: RecipeVariableMode,
): boolean {
  return FIELD_RULES[field].type(dataType) && FIELD_RULES[field].modes.includes(mode);
}

/** Configuración con los campos que no aplican a su tipo y modo puestos a `null`. */
export function applicableConfig(
  dataType: string,
  config: RecipeVariableConfig,
): RecipeVariableConfig {
  const result = { ...config };
  for (const field of CONFIG_FIELDS) {
    if (!fieldApplies(field, dataType, config.mode)) {
      (result as Record<RecipeConfigField, unknown>)[field] = null;
    }
  }
  return result;
}

/**
 * Cambia el modo de una variable sin perder lo configurado (los campos que no
 * aplican se conservan en el borrador y se quitan al guardar). Al pasar a un
 * modo fijo sin valor fijo, propone el valor por defecto, y al revés.
 */
export function changeMode(
  variable: RecipeTemplateVariable,
  mode: RecipeVariableMode,
): RecipeTemplateVariable {
  const config = { ...variable.config, mode };
  if (isFixedMode(mode) && config.fixedValue === null) {
    config.fixedValue = config.defaultValue ?? emptyValueFor(variable.dataType);
  }
  if (mode === 'EDITABLE' && config.defaultValue === null && config.fixedValue !== null) {
    config.defaultValue = config.fixedValue;
  }
  return { ...variable, isUnconfigured: false, config };
}

/** Valor con el que empieza un control vacío: «No», texto vacío o sin valor. */
export function emptyValueFor(dataType: string): RecipeValue | null {
  if (dataType === 'Boolean') {
    return false;
  }
  return dataType === 'String' ? '' : null;
}

/**
 * Reglas efectivas de una variable configurada, como las verá el formulario de
 * recetas: rango propio (solo en editables), si no el del mapeo.
 */
export function previewVariable(variable: RecipeTemplateVariable): RecipeVariable {
  const config = applicableConfig(variable.dataType, variable.config);
  return {
    signalVariableName: variable.signalVariableName,
    dataType: variable.dataType,
    comment: variable.comment,
    min: config.min ?? variable.mappingMin,
    max: config.max ?? variable.mappingMax,
    mode: variable.config.mode === 'FIXED_VISIBLE' ? 'FIXED_VISIBLE' : 'EDITABLE',
    label: config.label,
    helpText: config.helpText,
    unit: config.unit,
    decimals: config.decimals,
    minLength: config.minLength,
    maxLength: config.maxLength,
    booleanLabels: config.booleanLabels,
    options: config.options,
    defaultValue: config.defaultValue,
    fixedValue: config.fixedValue,
  };
}

// ---------------------------------------------------------------------------
// Disposición en el editor: filas y elementos con un id estable para pintar,
// arrastrar y asociar errores.
// ---------------------------------------------------------------------------

export interface EditorItem extends RecipeLayoutItem {
  uid: string;
}

export interface EditorRow {
  uid: string;
  items: EditorItem[];
}

let nextUid = 0;

function uid(prefix: string): string {
  nextUid += 1;
  return `${prefix}-${nextUid}`;
}

export function toEditorRows(layout: RecipeLayout): EditorRow[] {
  return layout.rows.map((row) => ({
    uid: uid('row'),
    items: row.items.map((item) => ({ ...item, uid: uid('item') })),
  }));
}

/** Disposición para la API: sin ids, sin filas vacías y cada elemento solo con sus campos. */
export function toLayout(rows: readonly EditorRow[]): RecipeLayout {
  return {
    rows: rows
      .filter((row) => row.items.length > 0)
      .map((row) => ({
        items: row.items.map((item): RecipeLayoutItem => {
          if (item.type === 'VARIABLE') {
            return {
              type: 'VARIABLE',
              span: item.span,
              signalVariableName: item.signalVariableName,
            };
          }
          if (item.type === 'SPACER') {
            return { type: 'SPACER', span: item.span };
          }
          return { type: item.type, span: item.span, text: (item.text ?? '').trim() };
        }),
      })),
  };
}

export function rowWidth(row: Pick<EditorRow, 'items'>): number {
  return row.items.reduce((total, item) => total + item.span, 0);
}

/** Coloca una variable al final: en la última fila si cabe, si no en una fila nueva. */
export function placeVariable(rows: readonly EditorRow[], name: string): EditorRow[] {
  if (rows.some((row) => row.items.some((item) => item.signalVariableName === name))) {
    return [...rows];
  }
  const item: EditorItem = {
    uid: uid('item'),
    type: 'VARIABLE',
    span: NEW_VARIABLE_SPAN,
    signalVariableName: name,
  };
  const last = rows.at(-1);
  if (last && rowWidth(last) + NEW_VARIABLE_SPAN <= LAYOUT_COLUMNS) {
    return [...rows.slice(0, -1), { ...last, items: [...last.items, item] }];
  }
  return [...rows, { uid: uid('row'), items: [item] }];
}

/** Quita una variable de la disposición; las filas que se quedan vacías desaparecen. */
export function removeVariable(rows: readonly EditorRow[], name: string): EditorRow[] {
  return dropEmptyRows(
    rows.map((row) => ({
      ...row,
      items: row.items.filter((item) => item.signalVariableName !== name),
    })),
  );
}

function dropEmptyRows(rows: EditorRow[]): EditorRow[] {
  return rows.filter((row) => row.items.length > 0);
}

/** Mueve un elemento a la izquierda (`-1`) o a la derecha (`+1`) dentro de su fila. */
export function moveWithinRow(
  rows: readonly EditorRow[],
  rowIndex: number,
  itemIndex: number,
  delta: -1 | 1,
): EditorRow[] {
  const target = itemIndex + delta;
  const row = rows[rowIndex];
  if (!row || target < 0 || target >= row.items.length) {
    return [...rows];
  }
  const items = [...row.items];
  [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
  return rows.map((candidate, index) => (index === rowIndex ? { ...row, items } : candidate));
}

/**
 * Mueve un elemento a la fila de arriba (`-1`, al final) o de abajo (`+1`, al
 * principio). Si no hay fila en esa dirección, crea una.
 */
export function moveToAdjacentRow(
  rows: readonly EditorRow[],
  rowIndex: number,
  itemIndex: number,
  delta: -1 | 1,
): EditorRow[] {
  const item = rows[rowIndex]?.items[itemIndex];
  if (!item) {
    return [...rows];
  }
  const result = rows.map((row) => ({ ...row, items: [...row.items] }));
  result[rowIndex].items.splice(itemIndex, 1);
  const targetIndex = rowIndex + delta;
  if (targetIndex < 0) {
    result.unshift({ uid: uid('row'), items: [item] });
  } else if (targetIndex >= result.length) {
    result.push({ uid: uid('row'), items: [item] });
  } else if (delta < 0) {
    result[targetIndex].items.push(item);
  } else {
    result[targetIndex].items.unshift(item);
  }
  return dropEmptyRows(result);
}

/** Mueve un elemento a otra fila y posición (arrastrar y soltar). `toRow === rows.length` crea una fila. */
export function transferItem(
  rows: readonly EditorRow[],
  from: { row: number; index: number },
  to: { row: number; index: number },
): EditorRow[] {
  const item = rows[from.row]?.items[from.index];
  if (!item) {
    return [...rows];
  }
  const result = rows.map((row) => ({ ...row, items: [...row.items] }));
  result[from.row].items.splice(from.index, 1);
  if (to.row >= result.length) {
    result.push({ uid: uid('row'), items: [item] });
  } else {
    result[to.row].items.splice(to.index, 0, item);
  }
  return dropEmptyRows(result);
}

export function moveRow(rows: readonly EditorRow[], rowIndex: number, delta: -1 | 1): EditorRow[] {
  const target = rowIndex + delta;
  if (target < 0 || target >= rows.length) {
    return [...rows];
  }
  const result = [...rows];
  [result[rowIndex], result[target]] = [result[target], result[rowIndex]];
  return result;
}

export function updateItem(
  rows: readonly EditorRow[],
  itemUid: string,
  changes: Partial<RecipeLayoutItem>,
): EditorRow[] {
  return rows.map((row) => ({
    ...row,
    items: row.items.map((item) => (item.uid === itemUid ? { ...item, ...changes } : item)),
  }));
}

/** Quita un título, texto o hueco (las variables se ocultan desde «Variables»). */
export function removeItem(rows: readonly EditorRow[], itemUid: string): EditorRow[] {
  return dropEmptyRows(
    rows.map((row) => ({
      ...row,
      items: row.items.filter((item) => item.uid !== itemUid || item.type === 'VARIABLE'),
    })),
  );
}

/**
 * Añade un elemento: un título o un texto en una fila nueva a todo el ancho,
 * y un hueco en la última fila si cabe (si no, en una nueva).
 */
export function addItem(
  rows: readonly EditorRow[],
  type: Exclude<RecipeLayoutItemType, 'VARIABLE'>,
): EditorRow[] {
  if (type === 'SPACER') {
    const item: EditorItem = { uid: uid('item'), type, span: 3 };
    const last = rows.at(-1);
    if (last && rowWidth(last) + item.span <= LAYOUT_COLUMNS) {
      return [...rows.slice(0, -1), { ...last, items: [...last.items, item] }];
    }
    return [...rows, { uid: uid('row'), items: [item] }];
  }
  const text = type === 'TITLE' ? 'Nueva sección' : '';
  return [...rows, { uid: uid('row'), items: [{ uid: uid('item'), type, span: 12, text }] }];
}

// ---------------------------------------------------------------------------
// Guardado, vista previa y validación en el cliente.
// ---------------------------------------------------------------------------

/** Cuerpo de `PUT …/recipe-template` y de `…/impact`. */
export function toTemplateRequest(
  variables: readonly RecipeTemplateVariable[],
  rows: readonly EditorRow[],
): RecipeTemplateRequest {
  return {
    variables: variables.map((variable) => ({
      signalVariableName: variable.signalVariableName,
      ...applicableConfig(variable.dataType, variable.config),
      ...trimmedTexts(variable.config),
    })),
    layout: toLayout(rows),
  };
}

function trimmedTexts(config: RecipeVariableConfig): Partial<RecipeVariableConfig> {
  const visible = isVisibleMode(config.mode);
  const text = (value: string | null) => (value?.trim() ? value.trim() : null);
  return visible
    ? {
        label: text(config.label),
        helpText: text(config.helpText),
        unit: config.unit ? text(config.unit) : null,
      }
    : {};
}

/** Lo que verá el formulario de recetas con el borrador actual (pestaña «Vista previa»). */
export function previewVariableSet(
  variables: readonly RecipeTemplateVariable[],
  rows: readonly EditorRow[],
): RecipeVariableSet {
  const visible = variables.filter((variable) => isVisibleMode(variable.config.mode));
  return {
    category: null,
    variables: visible.map(previewVariable),
    excludedCount: 0,
    layout: toLayout(rows),
    hiddenCount: variables.length - visible.length,
    isTemplateValid: true,
  };
}

/** Cuántas variables hay en cada modo (resumen de la cabecera). */
export function modeCounts(
  variables: readonly RecipeTemplateVariable[],
): Record<RecipeVariableMode, number> {
  const counts = Object.fromEntries(MODE_OPTIONS.map((option) => [option.mode, 0])) as Record<
    RecipeVariableMode,
    number
  >;
  for (const variable of variables) {
    counts[variable.config.mode] += 1;
  }
  return counts;
}

export type FieldErrors = Partial<Record<RecipeConfigField, string>>;

export interface TemplateErrors {
  /** Por variable y campo. */
  variables: Record<string, FieldErrors>;
  /** Por fila (id del editor). */
  rows: Record<string, string>;
  /** Por elemento (id del editor). */
  items: Record<string, string>;
  /** Errores generales de la disposición (p. ej. variables sin colocar). */
  layout: string[];
}

export function emptyErrors(): TemplateErrors {
  return { variables: {}, rows: {}, items: {}, layout: [] };
}

export function variableErrorCount(errors: TemplateErrors): number {
  return Object.values(errors.variables).reduce(
    (total, fields) => total + Object.keys(fields).length,
    0,
  );
}

export function layoutErrorCount(errors: TemplateErrors): number {
  return Object.keys(errors.rows).length + Object.keys(errors.items).length + errors.layout.length;
}

/**
 * Valida el borrador antes de guardar (spec 26, mismas reglas que el Backend):
 * valores fijos y por defecto, rangos, longitudes, decimales, opciones y la
 * disposición.
 */
export function validateTemplateDraft(
  variables: readonly RecipeTemplateVariable[],
  rows: readonly EditorRow[],
): TemplateErrors {
  const errors = emptyErrors();
  for (const variable of variables) {
    const fieldErrors = validateVariable(variable);
    if (Object.keys(fieldErrors).length > 0) {
      errors.variables[variable.signalVariableName] = fieldErrors;
    }
  }
  const labels = new Map(variables.map((variable) => [variable.signalVariableName, variable]));
  for (const row of rows) {
    if (rowWidth(row) > LAYOUT_COLUMNS) {
      errors.rows[row.uid] =
        'Esta fila ocupa más del 100 %. Reduce algún ancho o mueve un elemento.';
    }
    for (const item of row.items) {
      if (item.type === 'TITLE' || item.type === 'TEXT') {
        const limit = item.type === 'TITLE' ? MAX_LAYOUT_TITLE_LENGTH : MAX_LAYOUT_TEXT_LENGTH;
        const text = (item.text ?? '').trim();
        if (!text) {
          errors.items[item.uid] =
            item.type === 'TITLE' ? 'Escribe el título.' : 'Escribe el texto.';
        } else if (text.length > limit) {
          errors.items[item.uid] = `Máximo ${limit} caracteres.`;
        }
      }
    }
  }
  const placed = new Set(rows.flatMap((row) => row.items.map((item) => item.signalVariableName)));
  for (const variable of variables) {
    if (isVisibleMode(variable.config.mode) && !placed.has(variable.signalVariableName)) {
      errors.layout.push(
        `Falta colocar «${variableLabel(labelSource(labels.get(variable.signalVariableName)!))}».`,
      );
    }
  }
  return errors;
}

function labelSource(variable: RecipeTemplateVariable) {
  return { signalVariableName: variable.signalVariableName, label: variable.config.label };
}

function validateVariable(variable: RecipeTemplateVariable): FieldErrors {
  const errors: FieldErrors = {};
  const config = applicableConfig(variable.dataType, variable.config);
  const typeError = (value: number) => writeValueError({ dataType: variable.dataType }, value);

  for (const field of ['min', 'max'] as const) {
    const value = config[field];
    if (value === null) {
      continue;
    }
    if (Number.isNaN(value) || typeError(value)) {
      errors[field] = 'Fuera del rango que admite el tipo.';
    } else if (
      (variable.mappingMin !== null && value < variable.mappingMin) ||
      (variable.mappingMax !== null && value > variable.mappingMax)
    ) {
      errors[field] =
        `Debe estar dentro de los límites del mapeo (${limitsText(variable.mappingMin, variable.mappingMax)}).`;
    }
  }
  if (
    config.min !== null &&
    config.max !== null &&
    !errors.min &&
    !errors.max &&
    config.min > config.max
  ) {
    errors.max = 'El máximo no puede ser menor que el mínimo.';
  }
  const isLength = (value: number | null) =>
    value === null ||
    (Number.isInteger(value) && value >= 0 && value <= MAX_TEMPLATE_STRING_LENGTH);
  if (!isLength(config.minLength)) {
    errors.minLength = `Entre 0 y ${MAX_TEMPLATE_STRING_LENGTH}.`;
  }
  if (!isLength(config.maxLength)) {
    errors.maxLength = `Entre 0 y ${MAX_TEMPLATE_STRING_LENGTH}.`;
  } else if (
    config.minLength !== null &&
    config.maxLength !== null &&
    !errors.minLength &&
    config.minLength > config.maxLength
  ) {
    errors.maxLength = 'No puede ser menor que la longitud mínima.';
  }
  if (
    config.decimals !== null &&
    !(
      Number.isInteger(config.decimals) &&
      config.decimals >= 0 &&
      config.decimals <= MAX_TEMPLATE_DECIMALS
    )
  ) {
    errors.decimals = `Entre 0 y ${MAX_TEMPLATE_DECIMALS}.`;
  }
  if (
    config.booleanLabels &&
    (!config.booleanLabels.falseLabel.trim() || !config.booleanLabels.trueLabel.trim())
  ) {
    errors.booleanLabels = 'Escribe los dos textos o quítalos.';
  }
  if (config.options) {
    const optionError = validateOptions(variable, config);
    if (optionError) {
      errors.options = optionError;
    }
  }
  const rules = rulesWithoutBrokenFields(variable, errors);
  if (config.defaultValue !== null) {
    const error = recipeValueError(rules, config.defaultValue);
    if (error) {
      errors.defaultValue = error;
    }
  }
  if (isFixedMode(config.mode)) {
    const error = recipeValueError(rules, config.fixedValue);
    if (error) {
      errors.fixedValue = config.fixedValue === null ? 'Un valor fijo es obligatorio.' : error;
    }
  }
  return errors;
}

function rulesWithoutBrokenFields(
  variable: RecipeTemplateVariable,
  errors: FieldErrors,
): RecipeVariable {
  const rules = previewVariable(variable);
  return {
    ...rules,
    min: errors.min ? variable.mappingMin : rules.min,
    max: errors.max ? variable.mappingMax : rules.max,
    options: errors.options ? null : rules.options,
    decimals: errors.decimals ? null : rules.decimals,
    minLength: errors.minLength ? null : rules.minLength,
    maxLength: errors.maxLength ? null : rules.maxLength,
  };
}

function validateOptions(
  variable: RecipeTemplateVariable,
  config: RecipeVariableConfig,
): string | null {
  const options = config.options ?? [];
  if (options.length < MIN_TEMPLATE_OPTIONS) {
    return `Añade al menos ${MIN_TEMPLATE_OPTIONS} opciones o quita la lista.`;
  }
  if (options.length > MAX_TEMPLATE_OPTIONS) {
    return `Como mucho ${MAX_TEMPLATE_OPTIONS} opciones.`;
  }
  if (options.some((option) => !option.label.trim())) {
    return 'Todas las opciones necesitan un texto.';
  }
  if (new Set(options.map((option) => option.value)).size !== options.length) {
    return 'Hay valores repetidos.';
  }
  const rules = { ...previewVariable(variable), options: null };
  const invalid = options.find((option) => recipeValueError(rules, option.value) !== null);
  return invalid ? `El valor ${invalid.value} no es válido para esta variable.` : null;
}

function limitsText(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    return `${min} a ${max}`;
  }
  return min !== null ? `mínimo ${min}` : `máximo ${max}`;
}

const RANGE_REASONS: ReadonlyMap<string, string> = new Map([
  ['MIN_GREATER_THAN_MAX', 'El máximo no puede ser menor que el mínimo.'],
  ['OUT_OF_TYPE_RANGE', 'Fuera del rango que admite el tipo.'],
  ['OUT_OF_MAPPING_RANGE', 'Fuera de los límites del mapeo.'],
]);

const ISSUE_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['MISSING', 'Falta configurar esta variable.'],
  ['NOT_A_RECIPE_VARIABLE', 'Ya no es una variable de la receta.'],
  ['DUPLICATED', 'Variable repetida.'],
  ['NOT_APPLICABLE', 'Este ajuste no aplica a la variable.'],
  ['FIXED_VALUE_REQUIRED', 'Un valor fijo es obligatorio.'],
  ['INVALID_LENGTH', 'Longitud no válida.'],
  ['INVALID_DECIMALS', `Entre 0 y ${MAX_TEMPLATE_DECIMALS}.`],
  ['INVALID_OPTIONS', 'Revisa las opciones.'],
  ['INVALID_DEFAULT_VALUE', 'El valor por defecto no cumple las reglas.'],
  ['INVALID_FIXED_VALUE', 'El valor fijo no cumple las reglas.'],
  ['EMPTY_ROW', 'Fila vacía.'],
  ['ROW_TOO_WIDE', 'Esta fila ocupa más del 100 %.'],
  ['INVALID_SPAN', 'Ancho no permitido.'],
  ['TEXT_REQUIRED', 'Escribe el texto.'],
  ['TEXT_TOO_LONG', 'Texto demasiado largo.'],
  ['VARIABLE_NOT_VISIBLE', 'Esta variable está oculta: no puede estar en la disposición.'],
  ['VARIABLE_REPEATED', 'Variable repetida en la disposición.'],
]);

/** Mensaje de un problema devuelto por el Backend (`400 INVALID_RECIPE_TEMPLATE`). */
export function templateIssueMessage(issue: RecipeTemplateIssue): string {
  if (issue.reason === 'INVALID_RANGE' && issue.rangeReason) {
    return RANGE_REASONS.get(issue.rangeReason) ?? 'Rango no válido.';
  }
  return ISSUE_MESSAGES.get(issue.reason) ?? 'Revisa este ajuste.';
}

/** Reparte los problemas del Backend entre variables, filas y elementos del editor. */
export function mapServerIssues(
  issues: readonly RecipeTemplateIssue[],
  rows: readonly EditorRow[],
): TemplateErrors {
  const errors = emptyErrors();
  for (const issue of issues) {
    const message = templateIssueMessage(issue);
    if (issue.row !== undefined) {
      const row = rows.filter((candidate) => candidate.items.length > 0)[issue.row];
      const item = issue.item !== undefined ? row?.items[issue.item] : undefined;
      if (item) {
        errors.items[item.uid] = message;
      } else if (row) {
        errors.rows[row.uid] = message;
      } else {
        errors.layout.push(message);
      }
    } else if (issue.reason === 'VARIABLE_NOT_PLACED') {
      errors.layout.push(`Falta colocar «${issue.signalVariableName}».`);
    } else if (issue.signalVariableName) {
      const field: RecipeConfigField = issue.field ?? 'label';
      errors.variables[issue.signalVariableName] = {
        ...errors.variables[issue.signalVariableName],
        [field]: message,
      };
    } else {
      errors.layout.push(message);
    }
  }
  return errors;
}

const STALE_FIELD_LABELS: Partial<Record<RecipeConfigField, string>> = {
  min: 'el mínimo',
  max: 'el máximo',
  decimals: 'los decimales',
  minLength: 'la longitud mínima',
  maxLength: 'la longitud máxima',
  options: 'las opciones',
  booleanLabels: 'los textos de Sí/No',
  unit: 'la unidad',
  defaultValue: 'el valor por defecto',
  fixedValue: 'el valor fijo',
  label: 'el nombre visible',
  helpText: 'el texto de ayuda',
};

/** Aviso legible de una configuración guardada que ya no vale. */
export function staleConfigMessage(stale: StaleTemplateConfig): string {
  const field = STALE_FIELD_LABELS[stale.field] ?? stale.field;
  return stale.field === 'fixedValue'
    ? `${stale.signalVariableName}: el valor fijo ya no es válido. Corrígelo para poder activar recetas.`
    : `${stale.signalVariableName}: ${field} ya no vale y se ignora.`;
}

/** Texto del diálogo de confirmación cuando guardar deja recetas incompletas. */
export function impactMessage(impact: RecipeTemplateImpact): string {
  const count = impact.recipesBecomingIncomplete;
  const recipes = count === 1 ? '1 receta incompleta' : `${count} recetas incompletas`;
  const active = impact.activeRecipeBecomingIncomplete
    ? ` (entre ellas la activa, «${impact.activeRecipeBecomingIncomplete.title}»)`
    : '';
  const examples =
    impact.examples.length > 0
      ? ` Por ejemplo: ${impact.examples.map((title) => `«${title}»`).join(', ')}.`
      : '';
  return `Este cambio deja ${recipes}${active}. Habrá que revisarlas antes de poder activarlas.${examples}`;
}

const API_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['INVALID_RECIPE_TEMPLATE', 'Revisa los ajustes marcados.'],
  ['RECIPE_TEMPLATE_MODIFIED', 'Otra persona ha guardado cambios en la receta base.'],
  ['RECIPE_VARIABLES_NOT_AVAILABLE', 'Esta máquina no tiene variables de receta.'],
  ['MACHINE_NOT_FOUND', 'La máquina no existe.'],
]);

export function templateErrorMessage(error: ApiError): string {
  return API_ERROR_MESSAGES.get(error.code) ?? 'No se ha podido completar la operación.';
}

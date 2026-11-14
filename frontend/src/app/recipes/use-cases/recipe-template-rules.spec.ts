import { RecipeTemplateVariable, RecipeVariableConfig } from '../entities/recipe-template.model';
import {
  EditorRow,
  addItem,
  applicableConfig,
  changeMode,
  dataTypeLabel,
  impactMessage,
  layoutErrorCount,
  mapServerIssues,
  modeCounts,
  moveRow,
  moveToAdjacentRow,
  moveWithinRow,
  placeVariable,
  previewVariable,
  previewVariableSet,
  removeItem,
  removeVariable,
  rowWidth,
  spanLabel,
  staleConfigMessage,
  templateErrorMessage,
  templateIssueMessage,
  toEditorRows,
  toLayout,
  toTemplateRequest,
  transferItem,
  updateItem,
  validateTemplateDraft,
  variableErrorCount,
} from './recipe-template-rules';

function config(overrides: Partial<RecipeVariableConfig> = {}): RecipeVariableConfig {
  return {
    mode: 'EDITABLE',
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
    ...overrides,
  };
}

function variable(
  name: string,
  dataType: string,
  overrides: Partial<RecipeVariableConfig> = {},
  extra: Partial<RecipeTemplateVariable> = {},
): RecipeTemplateVariable {
  return {
    signalVariableName: name,
    dataType,
    comment: null,
    mappingMin: null,
    mappingMax: null,
    isUnconfigured: false,
    suggestedOptions: null,
    suggestedBooleanLabels: null,
    config: config(overrides),
    ...extra,
  };
}

function rows(...spans: { name: string; span: number }[][]): EditorRow[] {
  return toEditorRows({
    rows: spans.map((items) => ({
      items: items.map(({ name, span }) => ({
        type: 'VARIABLE' as const,
        span,
        signalVariableName: name,
      })),
    })),
  });
}

function names(editorRows: EditorRow[]): string[][] {
  return editorRows.map((row) => row.items.map((item) => item.signalVariableName ?? item.type));
}

describe('recipe-template-rules (docs/specs/26-receta-base.md)', () => {
  describe('modos y campos', () => {
    it('al pasar a fija propone el valor por defecto, y al volver a editable lo conserva', () => {
      const espiras = variable('rEspiras', 'Float', { defaultValue: 100 });
      const fixed = changeMode(espiras, 'FIXED_HIDDEN');
      expect(fixed.config).toMatchObject({ mode: 'FIXED_HIDDEN', fixedValue: 100 });

      const sentido = changeMode(
        variable('xSentido', 'Boolean', { mode: 'HIDDEN' }),
        'FIXED_VISIBLE',
      );
      expect(sentido.config.fixedValue).toBe(false);

      const back = changeMode(
        variable('iModo', 'Int16', { mode: 'FIXED_VISIBLE', fixedValue: 2 }),
        'EDITABLE',
      );
      expect(back.config.defaultValue).toBe(2);
    });

    it('cambiar el modo deja de considerarla sin configurar', () => {
      const nueva = variable('rNueva', 'Float', { mode: 'HIDDEN' }, { isUnconfigured: true });
      expect(changeMode(nueva, 'EDITABLE').isUnconfigured).toBe(false);
    });

    it('quita los campos que no aplican al tipo o al modo', () => {
      const result = applicableConfig(
        'Float',
        config({
          mode: 'FIXED_HIDDEN',
          label: 'x',
          min: 1,
          options: [],
          fixedValue: 3,
          unit: 'mm',
        }),
      );
      expect(result).toMatchObject({
        label: null,
        min: null,
        options: null,
        unit: null,
        fixedValue: 3,
      });
    });

    it('la vista previa usa el rango propio en editables y el del mapeo en las fijas', () => {
      const espiras = variable('rEspiras', 'Float', { min: 5 }, { mappingMin: 0, mappingMax: 900 });
      expect(previewVariable(espiras)).toMatchObject({ min: 5, max: 900, mode: 'EDITABLE' });
      const fixed = variable(
        'rEspiras',
        'Float',
        { mode: 'FIXED_VISIBLE', min: 5, fixedValue: 3 },
        { mappingMin: 0 },
      );
      expect(previewVariable(fixed)).toMatchObject({
        min: 0,
        mode: 'FIXED_VISIBLE',
        fixedValue: 3,
      });
    });

    it('nombra tipos y anchos de forma legible', () => {
      expect(dataTypeLabel('Boolean')).toBe('Sí / No');
      expect(dataTypeLabel('String')).toBe('Texto');
      expect(dataTypeLabel('Int16')).toBe('Entero (Int16)');
      expect(dataTypeLabel('Double')).toBe('Decimal (Double)');
      expect(spanLabel(4)).toBe('33 %');
      expect(spanLabel(5)).toBe('5/12');
    });

    it('cuenta las variables por modo', () => {
      const counts = modeCounts([
        variable('a', 'Float'),
        variable('b', 'Float', { mode: 'HIDDEN' }),
        variable('c', 'Float', { mode: 'HIDDEN' }),
      ]);
      expect(Object.entries(counts)).toEqual([
        ['EDITABLE', 1],
        ['FIXED_VISIBLE', 0],
        ['FIXED_HIDDEN', 0],
        ['HIDDEN', 2],
      ]);
    });
  });

  describe('disposición', () => {
    it('coloca una variable en la última fila si cabe y si no en una nueva', () => {
      expect(names(placeVariable(rows([{ name: 'a', span: 4 }]), 'b'))).toEqual([['a', 'b']]);
      expect(names(placeVariable(rows([{ name: 'a', span: 12 }]), 'b'))).toEqual([['a'], ['b']]);
      expect(names(placeVariable([], 'b'))).toEqual([['b']]);
      expect(names(placeVariable(rows([{ name: 'b', span: 4 }]), 'b'))).toEqual([['b']]);
    });

    it('quitar una variable elimina las filas que se quedan vacías', () => {
      const result = removeVariable(rows([{ name: 'a', span: 6 }], [{ name: 'b', span: 6 }]), 'a');
      expect(names(result)).toEqual([['b']]);
    });

    it('mueve dentro de la fila y entre filas', () => {
      const start = rows(
        [
          { name: 'a', span: 4 },
          { name: 'b', span: 4 },
        ],
        [{ name: 'c', span: 4 }],
      );
      expect(names(moveWithinRow(start, 0, 0, 1))).toEqual([['b', 'a'], ['c']]);
      expect(names(moveWithinRow(start, 0, 0, -1))).toEqual([['a', 'b'], ['c']]);
      expect(names(moveToAdjacentRow(start, 0, 1, 1))).toEqual([['a'], ['b', 'c']]);
      expect(names(moveToAdjacentRow(start, 1, 0, -1))).toEqual([['a', 'b', 'c']]);
      expect(names(moveToAdjacentRow(start, 0, 0, -1))).toEqual([['a'], ['b'], ['c']]);
      expect(names(moveToAdjacentRow(start, 1, 0, 1))).toEqual([['a', 'b'], ['c']]);
    });

    it('arrastrar y soltar mueve a otra fila o a una nueva', () => {
      const start = rows(
        [
          { name: 'a', span: 4 },
          { name: 'b', span: 4 },
        ],
        [{ name: 'c', span: 4 }],
      );
      expect(names(transferItem(start, { row: 0, index: 0 }, { row: 1, index: 1 }))).toEqual([
        ['b'],
        ['c', 'a'],
      ]);
      expect(names(transferItem(start, { row: 1, index: 0 }, { row: 2, index: 0 }))).toEqual([
        ['a', 'b'],
        ['c'],
      ]);
    });

    it('sube y baja filas', () => {
      const start = rows([{ name: 'a', span: 4 }], [{ name: 'b', span: 4 }]);
      expect(names(moveRow(start, 1, -1))).toEqual([['b'], ['a']]);
      expect(names(moveRow(start, 0, -1))).toEqual([['a'], ['b']]);
    });

    it('añade títulos y textos en filas nuevas, y huecos donde caben', () => {
      const start = rows([{ name: 'a', span: 6 }]);
      const withTitle = addItem(start, 'TITLE');
      expect(withTitle.at(-1)?.items[0]).toMatchObject({
        type: 'TITLE',
        span: 12,
        text: 'Nueva sección',
      });
      expect(addItem(start, 'TEXT').at(-1)?.items[0]).toMatchObject({ type: 'TEXT', text: '' });
      expect(names(addItem(start, 'SPACER'))).toEqual([['a', 'SPACER']]);
      expect(names(addItem(rows([{ name: 'a', span: 12 }]), 'SPACER'))).toEqual([
        ['a'],
        ['SPACER'],
      ]);
    });

    it('quita títulos, textos y huecos, pero no variables', () => {
      const start = addItem(rows([{ name: 'a', span: 6 }]), 'SPACER');
      const spacer = start[0].items[1];
      expect(names(removeItem(start, spacer.uid))).toEqual([['a']]);
      expect(names(removeItem(start, start[0].items[0].uid))).toEqual([['a', 'SPACER']]);
    });

    it('cambia el ancho de un elemento y mide la fila', () => {
      const start = rows([{ name: 'a', span: 6 }]);
      const updated = updateItem(start, start[0].items[0].uid, { span: 3 });
      expect(rowWidth(updated[0])).toBe(3);
    });

    it('convierte a la forma de la API sin ids, sin filas vacías y con los textos recortados', () => {
      const editor = [
        ...toEditorRows({
          rows: [
            { items: [{ type: 'TITLE', span: 12, text: '  Bobinado ', signalVariableName: 'x' }] },
            { items: [{ type: 'SPACER', span: 3, text: 'x' }] },
          ],
        }),
        { uid: 'vacía', items: [] },
      ];
      expect(toLayout(editor)).toEqual({
        rows: [
          { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
          { items: [{ type: 'SPACER', span: 3 }] },
        ],
      });
    });
  });

  describe('guardado y vista previa', () => {
    it('el cuerpo solo lleva los campos que aplican y los textos recortados', () => {
      const request = toTemplateRequest(
        [
          variable('rEspiras', 'Float', {
            label: '  Espiras ',
            helpText: ' ',
            unit: 'mm',
            fixedValue: 3,
          }),
          variable('xSentido', 'Boolean', { mode: 'HIDDEN', label: 'Sentido' }),
        ],
        rows([{ name: 'rEspiras', span: 12 }]),
      );
      expect(request.variables[0]).toMatchObject({
        signalVariableName: 'rEspiras',
        label: 'Espiras',
        helpText: null,
        unit: 'mm',
        fixedValue: null,
      });
      expect(request.variables[1]).toMatchObject({ mode: 'HIDDEN', label: null });
      expect(request.layout.rows).toHaveLength(1);
    });

    it('la vista previa solo trae las visibles y cuenta las ocultas', () => {
      const preview = previewVariableSet(
        [
          variable('a', 'Float'),
          variable('b', 'Float', { mode: 'FIXED_HIDDEN', fixedValue: 1 }),
          variable('c', 'Float', { mode: 'HIDDEN' }),
        ],
        rows([{ name: 'a', span: 12 }]),
      );
      expect(preview.variables.map((entry) => entry.signalVariableName)).toEqual(['a']);
      expect(preview.hiddenCount).toBe(2);
    });
  });

  describe('validateTemplateDraft', () => {
    const layout = (...names: string[]) => rows(names.map((name) => ({ name, span: 4 })));

    it('una receta base correcta no tiene errores', () => {
      const errors = validateTemplateDraft(
        [
          variable(
            'rEspiras',
            'Float',
            { min: 1, max: 500, decimals: 1, defaultValue: 2.5 },
            { mappingMin: 0, mappingMax: 900 },
          ),
          variable('xSentido', 'Boolean', { mode: 'FIXED_HIDDEN', fixedValue: true }),
        ],
        layout('rEspiras'),
      );
      expect(variableErrorCount(errors) + layoutErrorCount(errors)).toBe(0);
    });

    it('detecta rangos fuera del mapeo o del tipo, y mínimo mayor que máximo', () => {
      const errors = validateTemplateDraft(
        [
          variable('rEspiras', 'Float', { max: 1000 }, { mappingMax: 900 }),
          variable('iModo', 'Int16', { min: -40000 }),
          variable('rVel', 'Float', { min: 10, max: 5 }),
        ],
        layout('rEspiras', 'iModo', 'rVel'),
      );
      expect(errors.variables['rEspiras'].max).toMatch(/límites del mapeo/);
      expect(errors.variables['iModo'].min).toBe('Fuera del rango que admite el tipo.');
      expect(errors.variables['rVel'].max).toBe('El máximo no puede ser menor que el mínimo.');
    });

    it('exige valor fijo válido y valida el valor por defecto', () => {
      const errors = validateTemplateDraft(
        [
          variable('rEspiras', 'Float', { mode: 'FIXED_HIDDEN', fixedValue: null }),
          variable('rVel', 'Float', { max: 10, defaultValue: 20 }),
        ],
        layout('rVel'),
      );
      expect(errors.variables['rEspiras'].fixedValue).toBe('Un valor fijo es obligatorio.');
      expect(errors.variables['rVel'].defaultValue).toBe('Máximo 10.');
    });

    it('valida longitudes, decimales, textos de Sí/No y opciones', () => {
      const errors = validateTemplateDraft(
        [
          variable('sNombre', 'String', { minLength: 10, maxLength: 5 }),
          variable('sOtro', 'String', { minLength: 300 }),
          variable('rEspiras', 'Float', { decimals: 9 }),
          variable('xSentido', 'Boolean', { booleanLabels: { falseLabel: 'A', trueLabel: ' ' } }),
          variable('iModo', 'Int16', { options: [{ value: 1, label: 'A' }] }),
          variable('iOtro', 'Int16', {
            options: [
              { value: 1, label: 'A' },
              { value: 1, label: 'B' },
            ],
          }),
          variable('iSin', 'Int16', {
            options: [
              { value: 1, label: 'A' },
              { value: 2, label: ' ' },
            ],
          }),
          variable('bByte', 'Byte', {
            options: [
              { value: 1, label: 'A' },
              { value: 300, label: 'B' },
            ],
          }),
        ],
        layout('sNombre', 'sOtro', 'rEspiras', 'xSentido', 'iModo', 'iOtro', 'iSin', 'bByte'),
      );
      expect(errors.variables['sNombre'].maxLength).toBe(
        'No puede ser menor que la longitud mínima.',
      );
      expect(errors.variables['sOtro'].minLength).toBe('Entre 0 y 256.');
      expect(errors.variables['rEspiras'].decimals).toBe('Entre 0 y 6.');
      expect(errors.variables['xSentido'].booleanLabels).toBe('Escribe los dos textos o quítalos.');
      expect(errors.variables['iModo'].options).toMatch(/al menos 2/);
      expect(errors.variables['iOtro'].options).toBe('Hay valores repetidos.');
      expect(errors.variables['iSin'].options).toBe('Todas las opciones necesitan un texto.');
      expect(errors.variables['bByte'].options).toBe(
        'El valor 300 no es válido para esta variable.',
      );
    });

    it('detecta filas de más del 100 %, textos vacíos y variables visibles sin colocar', () => {
      const editor = [
        ...rows([
          { name: 'a', span: 8 },
          { name: 'b', span: 6 },
        ]),
        ...toEditorRows({ rows: [{ items: [{ type: 'TITLE', span: 12, text: ' ' }] }] }),
      ];
      const errors = validateTemplateDraft(
        [variable('a', 'Float'), variable('b', 'Float'), variable('c', 'Float', { label: 'Ce' })],
        editor,
      );
      expect(errors.rows[editor[0].uid]).toMatch(/más del 100 %/);
      expect(errors.items[editor[1].items[0].uid]).toBe('Escribe el título.');
      expect(errors.layout).toEqual(['Falta colocar «Ce».']);
      expect(layoutErrorCount(errors)).toBe(3);
    });
  });

  describe('mensajes', () => {
    it('reparte los errores del Backend entre variables, filas y elementos', () => {
      const editor = rows([{ name: 'a', span: 6 }], [{ name: 'b', span: 6 }]);
      const errors = mapServerIssues(
        [
          {
            signalVariableName: 'a',
            field: 'max',
            reason: 'INVALID_RANGE',
            rangeReason: 'OUT_OF_MAPPING_RANGE',
          },
          { signalVariableName: 'b', reason: 'MISSING' },
          { row: 1, reason: 'ROW_TOO_WIDE' },
          { row: 0, item: 0, reason: 'TEXT_REQUIRED' },
          { signalVariableName: 'c', reason: 'VARIABLE_NOT_PLACED' },
          { reason: 'TOO_MANY_ROWS' },
          { row: 9, reason: 'EMPTY_ROW' },
        ],
        editor,
      );
      expect(errors.variables['a'].max).toBe('Fuera de los límites del mapeo.');
      expect(errors.variables['b'].label).toBe('Falta configurar esta variable.');
      expect(errors.rows[editor[1].uid]).toBe('Esta fila ocupa más del 100 %.');
      expect(errors.items[editor[0].items[0].uid]).toBe('Escribe el texto.');
      expect(errors.layout).toEqual(['Falta colocar «c».', 'Revisa este ajuste.', 'Fila vacía.']);
    });

    it('explica cada problema', () => {
      expect(templateIssueMessage({ reason: 'INVALID_RANGE' })).toBe('Revisa este ajuste.');
      expect(templateIssueMessage({ reason: 'INVALID_RANGE', rangeReason: 'X' })).toBe(
        'Rango no válido.',
      );
      expect(templateIssueMessage({ reason: 'FIXED_VALUE_REQUIRED' })).toBe(
        'Un valor fijo es obligatorio.',
      );
    });

    it('avisa de la configuración que ya no vale', () => {
      expect(
        staleConfigMessage({
          signalVariableName: 'rEspiras',
          field: 'max',
          reason: 'INVALID_RANGE',
        }),
      ).toBe('rEspiras: el máximo ya no vale y se ignora.');
      expect(
        staleConfigMessage({
          signalVariableName: 'iModo',
          field: 'fixedValue',
          reason: 'INVALID_FIXED_VALUE',
        }),
      ).toMatch(/Corrígelo para poder activar recetas/);
    });

    it('explica el impacto de guardar', () => {
      expect(
        impactMessage({
          recipesBecomingIncomplete: 12,
          activeRecipeBecomingIncomplete: { id: 'a', title: 'Bobina 120 mm' },
          examples: ['Bobina 120 mm', 'Bobina 80 mm'],
        }),
      ).toBe(
        'Este cambio deja 12 recetas incompletas (entre ellas la activa, «Bobina 120 mm»). Habrá que revisarlas antes de poder activarlas. Por ejemplo: «Bobina 120 mm», «Bobina 80 mm».',
      );
      expect(
        impactMessage({
          recipesBecomingIncomplete: 1,
          activeRecipeBecomingIncomplete: null,
          examples: [],
        }),
      ).toBe(
        'Este cambio deja 1 receta incompleta. Habrá que revisarlas antes de poder activarlas.',
      );
    });

    it('traduce los errores de la API', () => {
      expect(
        templateErrorMessage({ status: 409, code: 'RECIPE_TEMPLATE_MODIFIED', message: '' }),
      ).toMatch(/Otra persona/);
      expect(templateErrorMessage({ status: 500, code: 'X', message: '' })).toBe(
        'No se ha podido completar la operación.',
      );
    });
  });
});

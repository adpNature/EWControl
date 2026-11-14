import { describe, expect, it } from 'vitest';
import {
  blankVariableConfig,
  computeTemplateImpact,
  defaultTemplateContent,
  effectiveRules,
  inspectVariableConfig,
  type RecipeLayout,
  type RecipeTemplateContent,
  type RecipeVariableConfig,
  resolveRecipeTemplate,
  suggestFromComment,
  validateLayout,
  validateTemplateContent,
} from './recipe-template.vo';
import type { RecipeVariable } from './recipe.vo';

function variable(
  signalVariableName: string,
  dataType: string,
  limits: { min?: number; max?: number } = {},
): RecipeVariable {
  return {
    signalVariableName,
    dataType,
    comment: null,
    min: limits.min ?? null,
    max: limits.max ?? null,
  };
}

const ESPIRAS = variable('rEspiras', 'Float', { min: 0, max: 10000 });
const SENTIDO = variable('xSentidoCabezal', 'Boolean');
const MODO = variable('iModo', 'Int16');
const NOMBRE = variable('sNombre', 'String');
const VARIABLES = [ESPIRAS, SENTIDO, MODO, NOMBRE];

function config(
  name: string,
  mode: RecipeVariableConfig['mode'],
  extra: Partial<RecipeVariableConfig> = {},
): RecipeVariableConfig {
  return { ...blankVariableConfig(name, mode), ...extra };
}

function row(...items: RecipeLayout['rows'][number]['items']) {
  return { items };
}

function v(name: string, span = 4) {
  return { type: 'VARIABLE' as const, span, signalVariableName: name };
}

describe('defaultTemplateContent (spec 26, "Receta base por defecto")', () => {
  it('todas editables y en filas de tres al 33 % en el orden de la GVL', () => {
    const content = defaultTemplateContent(VARIABLES);
    expect(content.variables.map((entry) => entry.mode)).toEqual([
      'EDITABLE',
      'EDITABLE',
      'EDITABLE',
      'EDITABLE',
    ]);
    expect(content.layout.rows).toEqual([
      row(v('rEspiras'), v('xSentidoCabezal'), v('iModo')),
      row(v('sNombre')),
    ]);
  });
});

describe('effectiveRules (spec 26, "Reglas efectivas")', () => {
  it('el rango de la receta base sustituye al del mapeo', () => {
    const rules = effectiveRules(ESPIRAS, config('rEspiras', 'EDITABLE', { min: 10, max: 500 }));
    expect(rules).toMatchObject({ min: 10, max: 500 });
  });

  it('sin rango propio usa el del mapeo, y en una variable fija nunca el propio', () => {
    expect(effectiveRules(ESPIRAS, config('rEspiras', 'EDITABLE'))).toMatchObject({
      min: 0,
      max: 10000,
    });
    expect(
      effectiveRules(ESPIRAS, config('rEspiras', 'FIXED_HIDDEN', { min: 10, fixedValue: 5 })),
    ).toMatchObject({ min: 0, max: 10000 });
  });

  it('las opciones aplican en editables y fijas visibles', () => {
    const options = [
      { value: 0, label: 'A' },
      { value: 1, label: 'B' },
    ];
    expect(effectiveRules(MODO, config('iModo', 'FIXED_VISIBLE', { options })).options).toEqual(
      options,
    );
  });
});

describe('inspectVariableConfig (spec 26, criterio backend 2)', () => {
  it('una configuración correcta no tiene problemas', () => {
    const entry = config('rEspiras', 'EDITABLE', {
      label: 'Espiras',
      unit: 'vueltas',
      decimals: 1,
      min: 1,
      max: 500,
      defaultValue: 100.5,
    });
    expect(inspectVariableConfig(entry, ESPIRAS).issues).toEqual([]);
  });

  it('rechaza campos que no aplican al tipo o al modo', () => {
    const entry = config('xSentidoCabezal', 'FIXED_HIDDEN', {
      label: 'Sentido',
      unit: 'mm',
      fixedValue: true,
    });
    expect(inspectVariableConfig(entry, SENTIDO).issues).toEqual([
      { signalVariableName: 'xSentidoCabezal', field: 'label', reason: 'NOT_APPLICABLE' },
      { signalVariableName: 'xSentidoCabezal', field: 'unit', reason: 'NOT_APPLICABLE' },
    ]);
  });

  it('exige valor fijo en los modos fijos', () => {
    expect(inspectVariableConfig(config('iModo', 'FIXED_VISIBLE'), MODO).issues).toEqual([
      { signalVariableName: 'iModo', field: 'fixedValue', reason: 'FIXED_VALUE_REQUIRED' },
    ]);
  });

  it('el rango no puede salirse del tipo ni del mapeo, ni tener min > max', () => {
    expect(
      inspectVariableConfig(config('iModo', 'EDITABLE', { min: -40000 }), MODO).issues,
    ).toEqual([
      {
        signalVariableName: 'iModo',
        field: 'min',
        reason: 'INVALID_RANGE',
        rangeReason: 'OUT_OF_TYPE_RANGE',
        min: -32768,
        max: 32767,
      },
    ]);
    expect(
      inspectVariableConfig(config('rEspiras', 'EDITABLE', { max: 20000 }), ESPIRAS).issues,
    ).toEqual([
      {
        signalVariableName: 'rEspiras',
        field: 'max',
        reason: 'INVALID_RANGE',
        rangeReason: 'OUT_OF_MAPPING_RANGE',
        min: 0,
        max: 10000,
      },
    ]);
    expect(
      inspectVariableConfig(config('rEspiras', 'EDITABLE', { min: 50, max: 10 }), ESPIRAS).issues,
    ).toEqual([
      {
        signalVariableName: 'rEspiras',
        field: 'max',
        reason: 'INVALID_RANGE',
        rangeReason: 'MIN_GREATER_THAN_MAX',
      },
    ]);
  });

  it('un Double sin límite de tipo admite cualquier rango finito', () => {
    const real = variable('dLargo', 'Double');
    expect(
      inspectVariableConfig(config('dLargo', 'EDITABLE', { min: -1e300, max: 1e300 }), real).issues,
    ).toEqual([]);
  });

  it('valida longitud y decimales', () => {
    expect(
      inspectVariableConfig(config('sNombre', 'EDITABLE', { minLength: 10, maxLength: 5 }), NOMBRE)
        .issues,
    ).toEqual([{ signalVariableName: 'sNombre', field: 'maxLength', reason: 'INVALID_LENGTH' }]);
    expect(
      inspectVariableConfig(config('sNombre', 'EDITABLE', { minLength: 300 }), NOMBRE).issues,
    ).toEqual([{ signalVariableName: 'sNombre', field: 'minLength', reason: 'INVALID_LENGTH' }]);
    expect(
      inspectVariableConfig(config('rEspiras', 'EDITABLE', { decimals: 9 }), ESPIRAS).issues,
    ).toEqual([{ signalVariableName: 'rEspiras', field: 'decimals', reason: 'INVALID_DECIMALS' }]);
  });

  it('valida las opciones: mínimo dos, sin repetir y dentro del rango', () => {
    const invalid = [
      [{ value: 1, label: 'Solo' }],
      [
        { value: 1, label: 'A' },
        { value: 1, label: 'B' },
      ],
      [
        { value: 0, label: 'A' },
        { value: 40000, label: 'B' },
      ],
      [
        { value: 0, label: 'A' },
        { value: 1, label: ' ' },
      ],
    ];
    for (const options of invalid) {
      expect(inspectVariableConfig(config('iModo', 'EDITABLE', { options }), MODO).issues).toEqual([
        { signalVariableName: 'iModo', field: 'options', reason: 'INVALID_OPTIONS' },
      ]);
    }
  });

  it('valida valores por defecto y fijos con las reglas efectivas', () => {
    const options = [
      { value: 0, label: 'Continuar' },
      { value: 1, label: 'Parar' },
    ];
    expect(
      inspectVariableConfig(config('iModo', 'EDITABLE', { options, defaultValue: 2 }), MODO).issues,
    ).toEqual([
      {
        signalVariableName: 'iModo',
        field: 'defaultValue',
        reason: 'INVALID_DEFAULT_VALUE',
        valueReason: 'NOT_AN_OPTION',
      },
    ]);
    expect(
      inspectVariableConfig(config('rEspiras', 'FIXED_HIDDEN', { fixedValue: 20000 }), ESPIRAS)
        .issues,
    ).toEqual([
      {
        signalVariableName: 'rEspiras',
        field: 'fixedValue',
        reason: 'INVALID_FIXED_VALUE',
        valueReason: 'OUT_OF_RANGE',
      },
    ]);
  });

  it('el saneado quita lo que falla salvo el valor fijo', () => {
    const { sanitized } = inspectVariableConfig(
      config('iModo', 'FIXED_VISIBLE', { unit: 'mm', label: 'Modo', fixedValue: 3.5 }),
      MODO,
    );
    expect(sanitized).toMatchObject({ unit: 'mm', label: 'Modo', fixedValue: 3.5 });
    const { sanitized: dropped } = inspectVariableConfig(
      config('rEspiras', 'EDITABLE', { max: 20000, defaultValue: 15000 }),
      ESPIRAS,
    );
    expect(dropped).toMatchObject({ max: null, defaultValue: null });
  });
});

describe('validateLayout (spec 26, "Disposición")', () => {
  it('una disposición correcta no tiene problemas', () => {
    const layout = {
      rows: [
        row({ type: 'TITLE', span: 12, text: 'Bobinado' }),
        row(v('rEspiras', 6), { type: 'SPACER', span: 6 }),
        row(v('iModo', 3), { type: 'TEXT', span: 9, text: 'Ayuda' }),
      ],
    };
    expect(validateLayout(layout, ['rEspiras', 'iModo'])).toEqual([]);
  });

  it('detecta filas vacías, demasiado anchas, anchos no permitidos y textos', () => {
    const layout: RecipeLayout = {
      rows: [
        row(),
        row(v('rEspiras', 8), v('iModo', 6)),
        row({ type: 'TITLE', span: 5, text: ' ' }),
        row({ type: 'TITLE', span: 12, text: 'x'.repeat(81) }),
      ],
    };
    expect(validateLayout(layout, ['rEspiras', 'iModo'])).toEqual([
      { row: 0, reason: 'EMPTY_ROW' },
      { row: 1, reason: 'ROW_TOO_WIDE' },
      { row: 2, item: 0, reason: 'INVALID_SPAN' },
      { row: 2, item: 0, reason: 'TEXT_REQUIRED' },
      { row: 3, item: 0, reason: 'TEXT_TOO_LONG' },
    ]);
  });

  it('cada variable visible exactamente una vez, y ninguna oculta', () => {
    const layout = { rows: [row(v('rEspiras'), v('rEspiras'), v('xSentidoCabezal'))] };
    expect(validateLayout(layout, ['rEspiras', 'iModo'])).toEqual([
      { row: 0, item: 1, signalVariableName: 'rEspiras', reason: 'VARIABLE_REPEATED' },
      { row: 0, item: 2, signalVariableName: 'xSentidoCabezal', reason: 'VARIABLE_NOT_VISIBLE' },
      { signalVariableName: 'iModo', reason: 'VARIABLE_NOT_PLACED' },
    ]);
  });

  it('no admite más de 200 filas', () => {
    const rows = Array.from({ length: 201 }, () => row({ type: 'SPACER', span: 3 }));
    expect(validateLayout({ rows }, [])).toContainEqual({ reason: 'TOO_MANY_ROWS' });
  });
});

describe('validateTemplateContent (spec 26, criterio backend 2)', () => {
  const valid: RecipeTemplateContent = {
    variables: [
      config('rEspiras', 'EDITABLE'),
      config('xSentidoCabezal', 'FIXED_HIDDEN', { fixedValue: true }),
      config('iModo', 'HIDDEN'),
      config('sNombre', 'FIXED_VISIBLE', { fixedValue: 'Bobina' }),
    ],
    layout: { rows: [row(v('rEspiras', 6), v('sNombre', 6))] },
  };

  it('una receta base correcta no tiene problemas', () => {
    expect(validateTemplateContent(valid, VARIABLES)).toEqual([]);
  });

  it('exige una configuración por variable de receta, sin repetidas ni ajenas', () => {
    const content: RecipeTemplateContent = {
      variables: [
        config('rEspiras', 'HIDDEN'),
        config('rEspiras', 'HIDDEN'),
        config('xOtra', 'HIDDEN'),
        config('xSentidoCabezal', 'HIDDEN'),
        config('iModo', 'HIDDEN'),
      ],
      layout: { rows: [] },
    };
    expect(validateTemplateContent(content, VARIABLES)).toEqual([
      { signalVariableName: 'rEspiras', reason: 'DUPLICATED' },
      { signalVariableName: 'xOtra', reason: 'NOT_A_RECIPE_VARIABLE' },
      { signalVariableName: 'sNombre', reason: 'MISSING' },
    ]);
  });

  it('junta los problemas de variables y de disposición', () => {
    const content = { ...valid, layout: { rows: [row(v('rEspiras', 6))] } };
    expect(validateTemplateContent(content, VARIABLES)).toEqual([
      { signalVariableName: 'sNombre', reason: 'VARIABLE_NOT_PLACED' },
    ]);
  });
});

describe('resolveRecipeTemplate (spec 26)', () => {
  it('sin receta base guardada usa la por defecto: todo editable', () => {
    const resolved = resolveRecipeTemplate(null, VARIABLES);
    expect(resolved.isDefault).toBe(true);
    expect(resolved.editableRules.map((rule) => rule.signalVariableName)).toEqual([
      'rEspiras',
      'xSentidoCabezal',
      'iModo',
      'sNombre',
    ]);
    expect(resolved.isValid).toBe(true);
    expect(resolved.nonEditableNames.size).toBe(0);
  });

  it('separa editables, valores fijos y ocultas', () => {
    const resolved = resolveRecipeTemplate(
      {
        variables: [
          config('rEspiras', 'EDITABLE', { max: 500 }),
          config('xSentidoCabezal', 'FIXED_HIDDEN', { fixedValue: true }),
          config('iModo', 'HIDDEN'),
          config('sNombre', 'FIXED_VISIBLE', { fixedValue: 'Bobina' }),
        ],
        layout: { rows: [row(v('rEspiras', 6), v('sNombre', 6))] },
      },
      VARIABLES,
    );
    expect(resolved.isDefault).toBe(false);
    expect(resolved.editableRules).toEqual([
      { ...ESPIRAS, max: 500, decimals: null, minLength: null, maxLength: null, options: null },
    ]);
    expect([...resolved.nonEditableNames]).toEqual(['xSentidoCabezal', 'iModo', 'sNombre']);
    expect(resolved.fixedValues).toEqual([
      { signalVariableName: 'xSentidoCabezal', value: true },
      { signalVariableName: 'sNombre', value: 'Bobina' },
    ]);
  });

  it('las variables nuevas cuentan como ocultas y las eliminadas se señalan', () => {
    const resolved = resolveRecipeTemplate(
      {
        variables: [config('rEspiras', 'EDITABLE'), config('xBorrada', 'EDITABLE')],
        layout: { rows: [row(v('rEspiras'), v('xBorrada'))] },
      },
      [ESPIRAS, SENTIDO],
    );
    expect(resolved.unconfiguredVariables).toEqual(['xSentidoCabezal']);
    expect(resolved.configs[1]).toMatchObject({
      signalVariableName: 'xSentidoCabezal',
      mode: 'HIDDEN',
    });
    expect(resolved.removedVariables).toEqual(['xBorrada']);
    expect(resolved.layout.rows).toEqual([row(v('rEspiras'))]);
  });

  it('ignora la configuración que ya no vale e invalida la receta base si falla un valor fijo', () => {
    const resolved = resolveRecipeTemplate(
      {
        variables: [
          config('rEspiras', 'EDITABLE', { max: 20000 }),
          config('iModo', 'FIXED_HIDDEN', { fixedValue: 2.5 }),
        ],
        layout: { rows: [row(v('rEspiras'))] },
      },
      [ESPIRAS, MODO],
    );
    expect(resolved.editableRules[0]).toMatchObject({ max: 10000 });
    expect(resolved.staleConfig).toEqual([
      {
        signalVariableName: 'rEspiras',
        field: 'max',
        reason: 'INVALID_RANGE',
        rangeReason: 'OUT_OF_MAPPING_RANGE',
      },
      {
        signalVariableName: 'iModo',
        field: 'fixedValue',
        reason: 'INVALID_FIXED_VALUE',
        valueReason: 'TYPE_MISMATCH',
      },
    ]);
    expect(resolved.isValid).toBe(false);
    expect(resolved.fixedValues).toEqual([]);
  });

  it('coloca al final las variables visibles que falten y quita filas que solo tienen huecos', () => {
    const resolved = resolveRecipeTemplate(
      {
        variables: [config('rEspiras', 'EDITABLE'), config('iModo', 'EDITABLE')],
        layout: { rows: [row(v('rEspiras')), row({ type: 'SPACER', span: 3 })] },
      },
      [ESPIRAS, MODO],
    );
    expect(resolved.layout.rows).toEqual([row(v('rEspiras')), row(v('iModo'))]);
  });
});

describe('suggestFromComment (spec 26)', () => {
  it('propone textos para un Boolean con 0 y 1', () => {
    expect(suggestFromComment('2 opciones: 0 - Horario / 1 - Antihorario', 'Boolean')).toEqual({
      options: null,
      booleanLabels: { falseLabel: 'Horario', trueLabel: 'Antihorario' },
    });
  });

  it('propone opciones para un entero, con o sin tilde y con espacios irregulares', () => {
    expect(suggestFromComment('3 Opción:0-Continuar /1 -  Parar/ 2 - Reiniciar ', 'Int16')).toEqual(
      {
        options: [
          { value: 0, label: 'Continuar' },
          { value: 1, label: 'Parar' },
          { value: 2, label: 'Reiniciar' },
        ],
        booleanLabels: null,
      },
    );
  });

  it('no propone nada si el comentario no sigue el patrón', () => {
    const none = { options: null, booleanLabels: null };
    expect(suggestFromComment(null, 'Int16')).toEqual(none);
    expect(suggestFromComment('Número de espiras', 'Int16')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A / texto suelto', 'Int16')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A', 'Int16')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A / 0 - B', 'Int16')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A / 1 - B', 'Float')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A / 300 - B', 'Byte')).toEqual(none);
    expect(suggestFromComment('opciones: 0 - A / 1 - B / 2 - C', 'Boolean')).toEqual(none);
  });
});

describe('computeTemplateImpact (spec 26, criterio backend 4)', () => {
  const recipes = [
    {
      id: 'a',
      title: 'Bobina A',
      isActivated: true,
      values: [{ signalVariableName: 'rEspiras', value: 800 }],
    },
    {
      id: 'b',
      title: 'Bobina B',
      isActivated: false,
      values: [{ signalVariableName: 'rEspiras', value: 100 }],
    },
    { id: 'c', title: 'Ya incompleta', isActivated: false, values: [] },
  ];

  it('cuenta las recetas completas que dejarían de estarlo, y la activa', () => {
    const current = [ESPIRAS];
    const proposed = [{ ...ESPIRAS, max: 500 }];
    expect(computeTemplateImpact(recipes, current, proposed)).toEqual({
      recipesBecomingIncomplete: 1,
      activeRecipeBecomingIncomplete: { id: 'a', title: 'Bobina A' },
      examples: ['Bobina A'],
    });
  });

  it('una variable que pasa a editable deja incompletas las recetas sin su valor', () => {
    const impact = computeTemplateImpact(recipes, [ESPIRAS], [ESPIRAS, MODO]);
    expect(impact.recipesBecomingIncomplete).toBe(2);
  });

  it('ocultar una variable no deja ninguna receta incompleta', () => {
    expect(computeTemplateImpact(recipes, [ESPIRAS], [])).toEqual({
      recipesBecomingIncomplete: 0,
      activeRecipeBecomingIncomplete: null,
      examples: [],
    });
  });
});

import { describe, expect, it } from 'vitest';
import type { OpcUaConnectionConfig } from './connection-config.vo';
import {
  assessRecipe,
  buildRecipeVariableSet,
  findRecipeCategory,
  normalizeForComparison,
  recipeSearchKey,
  type RecipeVariable,
  validateRecipeValues,
} from './recipe.vo';
import type { VariableCatalogEntry } from './variable-catalog-entry.entity';
import type { VariableCategory } from './variable-category.entity';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

function category(id: string, name: string, position: number, parentId: string | null = null) {
  return { id, machineId: 'machine-1', parentId, name, position } as VariableCategory;
}

function entry(
  name: string,
  categoryId: string | null,
  position: number,
  comment: string | null = null,
) {
  return {
    machineId: 'machine-1',
    nodeId: `${ROOT}.${name}`,
    categoryId,
    comment,
    position,
  } as VariableCatalogEntry;
}

function mapping(name: string, dataType?: string, limits: { min?: number; max?: number } = {}) {
  return { nodeId: `${ROOT}.${name}`, signalVariableName: name, dataType, ...limits };
}

const CATEGORIES = [
  category('root', 'Página programación receta', 1),
  category('recipe', 'Programacion para la receta', 2, 'root'),
  category('limits', 'Límites de los datos de la receta', 3, 'root'),
];

const CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    mapping('rEspiras', 'Float', { min: 0, max: 10000 }),
    mapping('xSentidoCabezal', 'Boolean'),
    mapping('iDireccionGuiador', 'Int16'),
    mapping('sNombreReceta', 'String'),
    mapping('aStruct', 'ns=4;i=3001'),
    mapping('rSinTipo'),
    mapping('rMinEspiras', 'Float'),
  ],
};

const ENTRIES = [
  entry('sNombreReceta', 'recipe', 4),
  entry('rEspiras', 'recipe', 1),
  entry('xSentidoCabezal', 'recipe', 2, '2 opciones: 0 - Horario / 1 - Antihorario'),
  entry('iDireccionGuiador', 'recipe', 3),
  entry('aStruct', 'recipe', 5),
  entry('rSinTipo', 'recipe', 6),
  entry('rNoMapeada', 'recipe', 7),
  entry('rMinEspiras', 'limits', 8),
];

const VARIABLES: RecipeVariable[] = buildRecipeVariableSet(CATEGORIES, ENTRIES, CONFIG).variables;

describe('normalizeForComparison', () => {
  it('ignora mayúsculas, tildes y espacios de los extremos', () => {
    expect(normalizeForComparison('  Programación PARA la Receta ')).toBe(
      'programacion para la receta',
    );
    expect(normalizeForComparison('bobina á')).toBe(normalizeForComparison('Bobina A'));
  });
});

describe('findRecipeCategory', () => {
  it('encuentra la categoría con o sin tilde, la primera en el orden de la GVL', () => {
    const duplicated = [category('later', 'Programación para la receta', 9), ...CATEGORIES];
    expect(findRecipeCategory(duplicated)?.id).toBe('recipe');
  });

  it('devuelve undefined si se ha renombrado a otra cosa', () => {
    expect(findRecipeCategory([category('x', 'Datos de receta', 1)])).toBeUndefined();
  });
});

describe('buildRecipeVariableSet (criterio backend 1)', () => {
  it('devuelve las variables mapeadas con tipo soportado, en el orden de la GVL, y cuenta las excluidas', () => {
    const set = buildRecipeVariableSet(CATEGORIES, ENTRIES, CONFIG);

    expect(set.category).toEqual({ id: 'recipe', name: 'Programacion para la receta' });
    expect(set.variables.map((variable) => variable.signalVariableName)).toEqual([
      'rEspiras',
      'xSentidoCabezal',
      'iDireccionGuiador',
      'sNombreReceta',
    ]);
    expect(set.variables[0]).toEqual({
      signalVariableName: 'rEspiras',
      dataType: 'Float',
      comment: null,
      min: 0,
      max: 10000,
    });
    expect(set.variables[1].comment).toBe('2 opciones: 0 - Horario / 1 - Antihorario');
    expect(set.excludedCount).toBe(3);
  });

  it('sin la categoría no hay variables', () => {
    expect(buildRecipeVariableSet([], ENTRIES, CONFIG)).toEqual({
      category: null,
      variables: [],
      excludedCount: 0,
    });
  });

  it('una Machine sin conexión OPC UA tiene la categoría pero ninguna variable', () => {
    const set = buildRecipeVariableSet(CATEGORIES, ENTRIES, null);
    expect(set.variables).toEqual([]);
    expect(set.excludedCount).toBe(7);
  });

  it('dos entradas del catálogo con el mismo signalVariableName solo cuentan una vez', () => {
    const config = {
      ...CONFIG,
      nodeMapping: [
        ...CONFIG.nodeMapping,
        { ...mapping('rEspiras', 'Float'), nodeId: `${ROOT}.otra` },
      ],
    };
    const set = buildRecipeVariableSet(
      CATEGORIES,
      [...ENTRIES, entry('otra', 'recipe', 10)],
      config,
    );
    expect(set.variables.filter((v) => v.signalVariableName === 'rEspiras')).toHaveLength(1);
  });
});

const COMPLETE = [
  { signalVariableName: 'rEspiras', value: 350 },
  { signalVariableName: 'xSentidoCabezal', value: false },
  { signalVariableName: 'iDireccionGuiador', value: 2 },
  { signalVariableName: 'sNombreReceta', value: '' },
];

describe('validateRecipeValues (criterio backend 4)', () => {
  it('acepta un valor válido para cada variable (la cadena vacía es un valor)', () => {
    expect(validateRecipeValues(COMPLETE, VARIABLES)).toEqual([]);
  });

  it('exige todas las variables', () => {
    expect(validateRecipeValues(COMPLETE.slice(1), VARIABLES)).toEqual([
      { signalVariableName: 'rEspiras', reason: 'MISSING' },
    ]);
  });

  it('informa de todos los problemas a la vez', () => {
    const issues = validateRecipeValues(
      [
        { signalVariableName: 'rEspiras', value: 20000 },
        { signalVariableName: 'xSentidoCabezal', value: 1 },
        { signalVariableName: 'iDireccionGuiador', value: 2.5 },
        { signalVariableName: 'iDireccionGuiador', value: 2 },
        { signalVariableName: 'sNombreReceta', value: 'a'.repeat(257) },
        { signalVariableName: 'rMinEspiras', value: 1 },
      ],
      VARIABLES,
    );

    expect(issues).toEqual([
      { signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', min: 0, max: 10000 },
      { signalVariableName: 'xSentidoCabezal', reason: 'TYPE_MISMATCH' },
      { signalVariableName: 'iDireccionGuiador', reason: 'TYPE_MISMATCH' },
      { signalVariableName: 'iDireccionGuiador', reason: 'DUPLICATED' },
      { signalVariableName: 'sNombreReceta', reason: 'TYPE_MISMATCH' },
      { signalVariableName: 'rMinEspiras', reason: 'NOT_A_RECIPE_VARIABLE' },
    ]);
  });

  it('un entero fuera del rango de su tipo es TYPE_MISMATCH', () => {
    const issues = validateRecipeValues(
      COMPLETE.map((v) =>
        v.signalVariableName === 'iDireccionGuiador' ? { ...v, value: 40000 } : v,
      ),
      VARIABLES,
    );
    expect(issues).toEqual([{ signalVariableName: 'iDireccionGuiador', reason: 'TYPE_MISMATCH' }]);
  });

  it('solo informa del límite que existe', () => {
    const onlyMax: RecipeVariable = { ...VARIABLES[0], min: null, max: 10 };
    expect(
      validateRecipeValues([{ signalVariableName: 'rEspiras', value: 11 }], [onlyMax]),
    ).toEqual([{ signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', max: 10 }]);
    const onlyMin: RecipeVariable = { ...VARIABLES[0], min: 5, max: null };
    expect(validateRecipeValues([{ signalVariableName: 'rEspiras', value: 1 }], [onlyMin])).toEqual(
      [{ signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', min: 5 }],
    );
  });
});

describe('assessRecipe (criterio backend 8)', () => {
  it('una receta con todos sus valores válidos está completa', () => {
    expect(assessRecipe(COMPLETE, VARIABLES)).toEqual({
      values: COMPLETE,
      missingVariables: [],
      staleValues: [],
      isComplete: true,
    });
  });

  it('detecta variables nuevas, valores que ya no valen y valores de variables que ya no son de receta', () => {
    const stored = [
      { signalVariableName: 'sNombreReceta', value: 'Bobina' },
      { signalVariableName: 'rEspiras', value: 20000 },
      { signalVariableName: 'xSentidoCabezal', value: true },
      { signalVariableName: 'rBorrada', value: 3 },
    ];

    expect(assessRecipe(stored, VARIABLES)).toEqual({
      values: [
        { signalVariableName: 'xSentidoCabezal', value: true },
        { signalVariableName: 'sNombreReceta', value: 'Bobina' },
      ],
      missingVariables: ['rEspiras', 'iDireccionGuiador'],
      staleValues: [
        { signalVariableName: 'rEspiras', value: 20000, reason: 'OUT_OF_RANGE' },
        { signalVariableName: 'rBorrada', value: 3, reason: 'NOT_A_RECIPE_VARIABLE' },
      ],
      isComplete: false,
    });
  });
});

describe('recipeSearchKey', () => {
  it('combina título y descripción normalizados', () => {
    expect(recipeSearchKey('Bobina Á', 'Cliente NORTE')).toBe('bobina a\ncliente norte');
    expect(recipeSearchKey('Bobina', null)).toBe('bobina');
  });
});

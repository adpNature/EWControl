import { describe, expect, it } from 'vitest';
import type { VariableCategoryList } from '../entities/variable-category.model';
import {
  buildCategoryTree,
  categoryErrorMessage,
  categoryFilterGroups,
  decodeCsvFile,
  importSummaryText,
  indexCatalog,
  matchesCategoryFilter,
  sortByCatalog,
} from './variable-categories';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const LIST: VariableCategoryList = {
  categories: [
    { id: 'c-1', parentId: null, name: 'Página receta', position: 0, variableCount: 3 },
    { id: 'c-2', parentId: 'c-1', name: 'Programación', position: 1, variableCount: 2 },
    { id: 'c-3', parentId: 'c-1', name: 'Límites', position: 2, variableCount: 1 },
    { id: 'c-4', parentId: null, name: 'Datos del HMI', position: 3, variableCount: 1 },
  ],
  variables: [
    { nodeId: `${ROOT}.ciPagina`, categoryId: null, comment: null, position: 0 },
    { nodeId: `${ROOT}.sHMInombre`, categoryId: 'c-4', comment: null, position: 1 },
    { nodeId: `${ROOT}.asCtrl`, categoryId: 'c-2', comment: 'Tiempos', position: 2 },
    { nodeId: `${ROOT}.xHome`, categoryId: 'c-2', comment: 'Home', position: 3 },
    { nodeId: `${ROOT}.rMin`, categoryId: 'c-3', comment: null, position: 4 },
  ],
};

describe('buildCategoryTree (docs/specs/23-categorias-variables-plc.md)', () => {
  it('anida las subcategorías bajo su categoría, en orden', () => {
    const tree = buildCategoryTree(LIST.categories);

    expect(
      tree.map((node) => [node.category.name, node.children.map((child) => child.name)]),
    ).toEqual([
      ['Página receta', ['Programación', 'Límites']],
      ['Datos del HMI', []],
    ]);
  });
});

describe('indexCatalog', () => {
  const index = indexCatalog(LIST);

  it('devuelve la ruta «Categoría › Subcategoría», o solo la categoría (criterio frontend 4)', () => {
    expect(index.pathFor(`${ROOT}.xHome`)).toBe('Página receta › Programación');
    expect(index.pathFor(`${ROOT}.sHMInombre`)).toBe('Datos del HMI');
  });

  it('los elementos de un array heredan la categoría y la descripción del array', () => {
    expect(index.pathFor(`${ROOT}.asCtrl[0]`)).toBe('Página receta › Programación');
    expect(index.commentFor(`${ROOT}.asCtrl[3]`)).toBe('Tiempos');
  });

  it('sin entrada o sin categoría devuelve null', () => {
    expect(index.pathFor(`${ROOT}.ciPagina`)).toBeNull();
    expect(index.pathFor('ns=2;s=Otra')).toBeNull();
    expect(index.commentFor('ns=2;s=Otra')).toBeNull();
  });
});

describe('matchesCategoryFilter (criterio frontend 4)', () => {
  const index = indexCatalog(LIST);

  it('«Todas» acepta cualquiera; «Sin categoría», las que no tienen', () => {
    expect(matchesCategoryFilter(index, `${ROOT}.xHome`, '')).toBe(true);
    expect(matchesCategoryFilter(index, `${ROOT}.ciPagina`, 'none')).toBe(true);
    expect(matchesCategoryFilter(index, 'ns=2;s=Otra', 'none')).toBe(true);
    expect(matchesCategoryFilter(index, `${ROOT}.xHome`, 'none')).toBe(false);
  });

  it('una categoría incluye sus subcategorías', () => {
    expect(matchesCategoryFilter(index, `${ROOT}.xHome`, 'c-1')).toBe(true);
    expect(matchesCategoryFilter(index, `${ROOT}.rMin`, 'c-1')).toBe(true);
    expect(matchesCategoryFilter(index, `${ROOT}.rMin`, 'c-2')).toBe(false);
    expect(matchesCategoryFilter(index, `${ROOT}.asCtrl[1]`, 'c-2')).toBe(true);
  });
});

describe('categoryFilterGroups', () => {
  it('ofrece cada categoría y sus subcategorías agrupadas', () => {
    expect(categoryFilterGroups(LIST.categories)).toEqual([
      {
        label: 'Página receta',
        options: [
          { value: 'c-1', label: 'Página receta (todas)' },
          { value: 'c-2', label: 'Programación' },
          { value: 'c-3', label: 'Límites' },
        ],
      },
      { label: 'Datos del HMI', options: [{ value: 'c-4', label: 'Datos del HMI' }] },
    ]);
  });
});

describe('sortByCatalog (criterio frontend 6)', () => {
  it('ordena por el CSV, deja al final las sin categoría y las que no están en el catálogo', () => {
    const index = indexCatalog(LIST);
    const items = [
      { nodeId: 'ns=2;s=Otra' },
      { nodeId: `${ROOT}.ciPagina` },
      { nodeId: `${ROOT}.rMin` },
      { nodeId: `${ROOT}.asCtrl[1]` },
      { nodeId: undefined },
      { nodeId: `${ROOT}.sHMInombre` },
    ];

    expect(sortByCatalog(items, index).map((item) => item.nodeId)).toEqual([
      `${ROOT}.sHMInombre`,
      `${ROOT}.asCtrl[1]`,
      `${ROOT}.rMin`,
      `${ROOT}.ciPagina`,
      'ns=2;s=Otra',
      undefined,
    ]);
  });
});

describe('decodeCsvFile (criterio frontend 3)', () => {
  it('decodifica UTF-8 y quita el BOM', () => {
    const bytes = new TextEncoder().encode(`${String.fromCharCode(0xfeff)}Página`);

    expect(decodeCsvFile(bytes.buffer)).toBe('Página');
  });

  it('si no es UTF-8 válido, usa Windows-1252 (exportación de CODESYS)', () => {
    const bytes = new Uint8Array([0x50, 0xe1, 0x67, 0x69, 0x6e, 0x61]); // «Página» en Windows-1252

    expect(decodeCsvFile(bytes.buffer)).toBe('Página');
  });
});

describe('textos', () => {
  it('resume la importación', () => {
    expect(
      importSummaryText({
        categories: 8,
        subcategories: 16,
        variables: 428,
        categorized: 408,
        uncategorized: 20,
        withComment: 70,
      }),
    ).toBe('8 categorías, 16 subcategorías y 428 variables (20 sin categoría).');
    expect(
      importSummaryText({
        categories: 1,
        subcategories: 0,
        variables: 1,
        categorized: 1,
        uncategorized: 0,
        withComment: 0,
      }),
    ).toBe('1 categoría, 0 subcategorías y 1 variable.');
  });

  it.each([
    [{ code: 'INVALID_GVL_EXPORT', details: { reason: 'Sin Comment.' } }, 'Sin Comment.'],
    [
      { code: 'VARIABLE_CATEGORY_NAME_TAKEN' },
      'Ya hay otra categoría con ese nombre en el mismo nivel.',
    ],
    [{ code: 'INVALID_VARIABLE_CATEGORY_NAME' }, 'El nombre debe tener entre 1 y 120 caracteres.'],
    [{ code: 'VARIABLE_CATEGORY_NOT_FOUND' }, 'La categoría ya no existe. Recarga la página.'],
    [{ code: 'MACHINE_NOT_FOUND' }, 'La Machine no existe o no tienes acceso.'],
    [{ code: 'OTRO' }, 'No se ha podido completar la operación. Inténtalo de nuevo.'],
  ])('mensaje de error para %o', (error, message) => {
    expect(categoryErrorMessage({ status: 400, message: '', ...error })).toBe(message);
  });
});

import { describe, expect, it } from 'vitest';
import {
  catalogNodeId,
  GVL_EXPORT_LIMITS,
  normalizeCategoryTitle,
  parseCsv,
  parseGvlExport,
} from './gvl-export';

const HEADER = 'Type,Name,Address,DataType,InitValue,Comment,Attribute';
const HASH = '#'.repeat(40);
const STAR = '*'.repeat(40);

function framed(frame: string, title: string): string {
  return `\t${frame}\r\n\t\t\r\n\t\t\t${title}\t\t\r\n\t\t\r\n\t${frame}\t`;
}

function row(name: string, comment = '', type = 'VAR_GLOBAL', dataType = 'BOOL'): string {
  const quoted = comment.includes('\n') || comment.includes(',') || comment.includes('"');
  return `${type},${name},,${dataType},,${quoted ? `"${comment.replace(/"/g, '""')}"` : comment},`;
}

/** Réplica reducida de la exportación de CODESYS de GVL_HMI. */
const CSV = [
  HEADER,
  row('ciPaginaInicial', '', 'VAR_GLOBAL CONSTANT', 'INT'),
  row('xAnularEdicion'),
  row('sHMInombre', framed(HASH, 'DATOS DEL HMI'), 'VAR_GLOBAL', 'STRING(16)'),
  row('idhcpHMI', '', 'VAR_GLOBAL', 'INT'),
  row(
    'iPaginaActual',
    `${framed(HASH, 'COMUNES A TODAS LAS PÁGINAS')}\r\n${framed(STAR, 'VALORES LAS PÁGINAS DEL HMI')}`,
    'VAR_GLOBAL',
    'INT',
  ),
  row('xSaltarPagina'),
  row('xIconoAlarma', framed(STAR, 'VISUALIZACION DE LOS ICONOOS DEL SISTEMA')),
  row('xCmdBobinadoHome', 'Home'),
  row('xUltimaCapaRepartir', '2 opciones:  0 - Anular repartir / 1 - Activar Repartir'),
  row('rTope', '"Auxiliar", con comillas', 'VAR_GLOBAL', 'REAL'),
].join('\r\n');

describe('parseCsv', () => {
  it('separa campos, respeta comillas, saltos de línea y comillas dobladas', () => {
    expect(parseCsv('a,"b\r\nc","d ""e"""\r\nf,,g\r\n')).toEqual([
      ['a', 'b\r\nc', 'd "e"'],
      ['f', '', 'g'],
    ]);
  });

  it('devuelve null si hay unas comillas sin cerrar', () => {
    expect(parseCsv('a,"b\nc')).toBeNull();
  });
});

describe('normalizeCategoryTitle (docs/specs/23-categorias-variables-plc.md, criterio 3)', () => {
  it.each([
    ['PAGINA ESTADO BOBINADO', 'Pagina estado bobinado'],
    ['  DATOS   DEL HMI ', 'Datos del HMI'],
    ['COMANDO DE MANUAL DESDE HMI', 'Comando de manual desde HMI'],
    ['VISUALIZACIÓN DE LOS PASOS (VISUALIZACIÓN)', 'Visualización de los pasos (visualización)'],
    ['ip y cpu del plc', 'IP y CPU del PLC'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeCategoryTitle(raw)).toBe(expected);
  });
});

describe('parseGvlExport (spec 23, criterios 1 y 2)', () => {
  it('crea categorías y subcategorías en orden y asigna cada variable a la última vista', () => {
    const result = parseGvlExport(CSV);
    if (!result.ok) throw new Error(result.reason);

    expect(result.export.categories).toEqual([
      { key: 0, parentKey: null, name: 'Datos del HMI', position: 0 },
      { key: 1, parentKey: null, name: 'Comunes a todas las páginas', position: 1 },
      { key: 2, parentKey: 1, name: 'Valores las páginas del HMI', position: 2 },
      { key: 3, parentKey: 1, name: 'Visualizacion de los iconoos del sistema', position: 3 },
    ]);
    expect(
      result.export.variables.map((variable) => [variable.name, variable.categoryKey]),
    ).toEqual([
      ['ciPaginaInicial', null],
      ['xAnularEdicion', null],
      ['sHMInombre', 0],
      ['idhcpHMI', 0],
      ['iPaginaActual', 2],
      ['xSaltarPagina', 2],
      ['xIconoAlarma', 3],
      ['xCmdBobinadoHome', 3],
      ['xUltimaCapaRepartir', 3],
      ['rTope', 3],
    ]);
    expect(result.export.variables.map((variable) => variable.position)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  it('usa los comentarios sin marco como descripción, colapsando espacios', () => {
    const result = parseGvlExport(CSV);
    if (!result.ok) throw new Error(result.reason);
    const comments = Object.fromEntries(
      result.export.variables.map((variable) => [variable.name, variable.comment]),
    );

    expect(comments.xCmdBobinadoHome).toBe('Home');
    expect(comments.xUltimaCapaRepartir).toBe(
      '2 opciones: 0 - Anular repartir / 1 - Activar Repartir',
    );
    expect(comments.rTope).toBe('"Auxiliar", con comillas');
    expect(comments.sHMInombre).toBeNull();
    expect(comments.idhcpHMI).toBeNull();
  });

  it('una subcategoría sin categoría previa se crea como raíz', () => {
    const result = parseGvlExport([HEADER, row('x', framed(STAR, 'SUELTA'))].join('\n'));

    expect(result.ok && result.export.categories).toEqual([
      { key: 0, parentKey: null, name: 'Suelta', position: 0 },
    ]);
  });

  it('dos títulos iguales crean dos categorías', () => {
    const result = parseGvlExport(
      [HEADER, row('a', framed(HASH, 'PAGINA')), row('b', framed(HASH, 'PAGINA'))].join('\n'),
    );

    expect(result.ok && result.export.categories.map((category) => category.key)).toEqual([0, 1]);
  });

  it('ignora las líneas vacías', () => {
    const result = parseGvlExport(`${HEADER}\n${row('a')}\n\n`);

    expect(result.ok && result.export.variables).toHaveLength(1);
  });

  it('recorta descripciones demasiado largas', () => {
    const result = parseGvlExport([HEADER, row('a', 'x'.repeat(900))].join('\n'));

    expect(result.ok && result.export.variables[0].comment).toHaveLength(
      GVL_EXPORT_LIMITS.maxCommentLength,
    );
  });

  it.each([
    ['sin columna Comment', 'Type,Name,DataType\nVAR_GLOBAL,a,BOOL', /Comment/],
    ['sin columna Name', 'Type,Comment\nVAR_GLOBAL,x', /Name/],
    ['vacío', '', /Name/],
    ['sin variables', HEADER, /ninguna variable/],
    ['con comillas sin cerrar', `${HEADER}\nVAR_GLOBAL,a,,BOOL,,"sin cerrar`, /comillas/],
    ['con un nombre no válido', `${HEADER}\n${row('1x')}`, /1x/],
    ['con un nombre vacío', `${HEADER}\n${row('')}`, /fila 2/],
    ['con una variable repetida', `${HEADER}\n${row('a')}\n${row('a')}`, /"a" está repetida/],
  ])('rechaza un CSV %s', (_label, csv, reason) => {
    const result = parseGvlExport(csv);

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toMatch(reason);
  });

  it('rechaza más variables o categorías de las permitidas', () => {
    const tooManyVariables = [HEADER];
    for (let index = 0; index <= GVL_EXPORT_LIMITS.maxVariables; index += 1) {
      tooManyVariables.push(row(`v${index}`));
    }
    const tooManyCategories = [HEADER];
    for (let index = 0; index <= GVL_EXPORT_LIMITS.maxCategories; index += 1) {
      tooManyCategories.push(row(`v${index}`, framed(HASH, `CAT ${index}`)));
    }

    expect(parseGvlExport(tooManyVariables.join('\n'))).toMatchObject({ ok: false });
    expect(parseGvlExport(tooManyCategories.join('\n'))).toMatchObject({ ok: false });
  });
});

describe('catalogNodeId', () => {
  it('compone el NodeId de CODESYS a partir de la carpeta y el nombre', () => {
    expect(catalogNodeId('ns=4;s=|var|PLC.Application.GVL_HMI', 'xAnularEdicion')).toBe(
      'ns=4;s=|var|PLC.Application.GVL_HMI.xAnularEdicion',
    );
  });
});

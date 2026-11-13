/**
 * Exportación CSV de una lista de variables globales (GVL) de CODESYS
 * (docs/specs/23-categorias-variables-plc.md): reglas puras para extraer el
 * árbol de categorías de los comentarios y la categoría y descripción de cada
 * variable. No conoce TypeORM ni el servidor OPC UA.
 */

export const GVL_EXPORT_LIMITS = {
  maxCsvLength: 90_000,
  maxVariables: 5000,
  maxCategories: 300,
  maxCategoryNameLength: 120,
  maxCommentLength: 500,
} as const;

/** Categoría del CSV; `key` es su índice y la referencia de `parentKey`/`categoryKey`. */
export type ParsedCategory = {
  key: number;
  parentKey: number | null;
  name: string;
  position: number;
};

export type ParsedVariable = {
  name: string;
  /** Subcategoría o, si no la hay, categoría; `null` antes del primer título. */
  categoryKey: number | null;
  comment: string | null;
  position: number;
};

export type GvlExport = { categories: ParsedCategory[]; variables: ParsedVariable[] };
export type GvlExportParseResult = { ok: true; export: GvlExport } | { ok: false; reason: string };

/** Identificador IEC 61131-3 de una variable de la GVL. */
const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PARENT_FRAME = /^#{5,}$/;
const CHILD_FRAME = /^\*{5,}$/;
const ACRONYMS = new Set(['HMI', 'PLC', 'IP', 'CPU']);

/**
 * CSV según RFC 4180: separador `,`, campos entre comillas con saltos de línea
 * y comillas dobladas (`""`). Las filas vacías se descartan. `null` si unas
 * comillas quedan sin cerrar.
 */
export function parseCsv(text: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const endRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
    row = [];
    field = '';
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      endRow();
    } else {
      field += char;
    }
  }
  if (inQuotes) {
    return null;
  }
  if (field !== '' || row.length > 0) {
    endRow();
  }
  return rows;
}

/**
 * Título del CSV (en mayúsculas) → nombre de categoría: minúsculas con la
 * primera letra en mayúscula, conservando las siglas conocidas y colapsando
 * espacios (spec 23, criterio 3).
 */
export function normalizeCategoryTitle(raw: string): string {
  const words = raw.trim().split(/\s+/).filter(Boolean);
  const text = words
    .map((word) => {
      const bare = word.replace(/[^\p{L}]/gu, '').toUpperCase();
      return ACRONYMS.has(bare) ? word.toUpperCase() : word.toLowerCase();
    })
    .join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

type CommentTitles = { parent: string | null; child: string | null; free: string | null };

/** Títulos enmarcados (`####` padre, `****` hijo) o, si no hay marcos, la descripción libre. */
function readComment(comment: string): CommentTitles {
  const lines = comment.split(/\r\n|\r|\n/).map((line) => line.replace(/\s+/g, ' ').trim());
  let parent: string | null = null;
  let child: string | null = null;
  let frame: 'parent' | 'child' | null = null;
  let buffer: string[] = [];
  let framed = false;

  for (const line of lines) {
    const kind = PARENT_FRAME.test(line) ? 'parent' : CHILD_FRAME.test(line) ? 'child' : null;
    if (kind) {
      framed = true;
      if (frame === kind) {
        const title = buffer.join(' ').trim();
        if (title) {
          if (kind === 'parent') parent = title;
          else child = title;
        }
        frame = null;
      } else {
        frame = kind;
      }
      buffer = [];
    } else if (frame && line) {
      buffer.push(line);
    }
  }
  if (framed) {
    return { parent, child, free: null };
  }
  const free = lines.filter(Boolean).join(' ').trim();
  return { parent: null, child: null, free: free || null };
}

/**
 * Árbol de categorías y catálogo de variables de una exportación de GVL
 * (spec 23, criterios 1 y 2). Cada título se aplica a su variable y a las
 * siguientes hasta el siguiente título; una subcategoría pertenece a la última
 * categoría vista (o es raíz si no hay ninguna).
 */
export function parseGvlExport(csv: string): GvlExportParseResult {
  const rows = parseCsv(csv);
  if (rows === null) {
    return { ok: false, reason: 'El CSV tiene unas comillas sin cerrar.' };
  }
  const header = (rows[0] ?? []).map((column) => column.trim());
  const nameIndex = header.indexOf('Name');
  const commentIndex = header.indexOf('Comment');
  if (nameIndex === -1) {
    return { ok: false, reason: 'El CSV no tiene la columna Name.' };
  }
  if (commentIndex === -1) {
    return { ok: false, reason: 'El CSV no tiene la columna Comment.' };
  }

  const categories: ParsedCategory[] = [];
  const variables: ParsedVariable[] = [];
  let currentParent: number | null = null;
  let currentCategory: number | null = null;
  const seen = new Set<string>();

  const addCategory = (title: string, parentKey: number | null): number => {
    const key = categories.length;
    categories.push({ key, parentKey, name: normalizeCategoryTitle(title), position: key });
    return key;
  };

  for (const [index, row] of rows.slice(1).entries()) {
    const name = (row[nameIndex] ?? '').trim();
    if (!VARIABLE_NAME_PATTERN.test(name)) {
      return {
        ok: false,
        reason: `La fila ${index + 2} tiene un nombre de variable no válido: "${name}".`,
      };
    }
    if (seen.has(name)) {
      return { ok: false, reason: `La variable "${name}" está repetida (fila ${index + 2}).` };
    }
    seen.add(name);
    const { parent, child, free } = readComment(row[commentIndex] ?? '');
    if (parent) {
      currentParent = addCategory(parent, null);
      currentCategory = currentParent;
    }
    if (child) {
      currentCategory = addCategory(child, currentParent);
      if (currentParent === null) {
        currentParent = currentCategory;
      }
    }
    variables.push({
      name,
      categoryKey: currentCategory,
      comment: free ? free.slice(0, GVL_EXPORT_LIMITS.maxCommentLength) : null,
      position: variables.length,
    });
    if (variables.length > GVL_EXPORT_LIMITS.maxVariables) {
      return {
        ok: false,
        reason: `El CSV tiene más de ${GVL_EXPORT_LIMITS.maxVariables} variables.`,
      };
    }
    if (categories.length > GVL_EXPORT_LIMITS.maxCategories) {
      return {
        ok: false,
        reason: `El CSV tiene más de ${GVL_EXPORT_LIMITS.maxCategories} categorías.`,
      };
    }
  }
  if (variables.length === 0) {
    return { ok: false, reason: 'El CSV no tiene ninguna variable.' };
  }
  return { ok: true, export: { categories, variables } };
}

/** NodeId de una variable de la GVL tal como lo expone CODESYS: `<carpeta>.<Nombre>`. */
export function catalogNodeId(rootNodeId: string, variableName: string): string {
  return `${rootNodeId}.${variableName}`;
}

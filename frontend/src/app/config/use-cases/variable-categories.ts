import { ApiError } from '../../core/http/api-error.model';
import {
  ImportVariableCategoriesSummary,
  VariableCatalogEntry,
  VariableCategory,
  VariableCategoryList,
} from '../entities/variable-category.model';

/**
 * Reglas de presentación de las categorías de variables del PLC
 * (docs/specs/23-categorias-variables-plc.md): funciones puras, sin Angular.
 */

export interface CategoryTreeNode {
  category: VariableCategory;
  children: VariableCategory[];
}

/** Categorías raíz con sus subcategorías debajo, en el orden del CSV. */
export function buildCategoryTree(categories: readonly VariableCategory[]): CategoryTreeNode[] {
  const sorted = [...categories].sort((a, b) => a.position - b.position);
  return sorted
    .filter((category) => category.parentId === null)
    .map((category) => ({
      category,
      children: sorted.filter((child) => child.parentId === category.id),
    }));
}

/** Búsquedas sobre el catálogo de una Machine. */
export interface CatalogIndex {
  /** Entrada del `nodeId` o, si es un elemento de array (`x[0]`), la del array. */
  entryFor(nodeId: string | undefined): VariableCatalogEntry | null;
  /** «Categoría › Subcategoría» o «Categoría»; `null` sin categoría. */
  pathFor(nodeId: string | undefined): string | null;
  commentFor(nodeId: string | undefined): string | null;
  /** Categoría raíz de una categoría (ella misma si es raíz). */
  rootOf(categoryId: string): string;
}

const ARRAY_INDEX_SUFFIX = /\[\d+\]$/;

export function indexCatalog(list: VariableCategoryList): CatalogIndex {
  const entries = new Map(list.variables.map((entry) => [entry.nodeId, entry]));
  const categories = new Map(list.categories.map((category) => [category.id, category]));

  const entryFor = (nodeId: string | undefined): VariableCatalogEntry | null => {
    let current = nodeId;
    while (current) {
      const entry = entries.get(current);
      if (entry) {
        return entry;
      }
      if (!ARRAY_INDEX_SUFFIX.test(current)) {
        return null;
      }
      current = current.replace(ARRAY_INDEX_SUFFIX, '');
    }
    return null;
  };

  return {
    entryFor,
    pathFor(nodeId) {
      const category = categories.get(entryFor(nodeId)?.categoryId ?? '');
      if (!category) {
        return null;
      }
      const parent = category.parentId ? categories.get(category.parentId) : undefined;
      return parent ? `${parent.name} › ${category.name}` : category.name;
    },
    commentFor(nodeId) {
      return entryFor(nodeId)?.comment ?? null;
    },
    rootOf(categoryId) {
      return categories.get(categoryId)?.parentId ?? categoryId;
    },
  };
}

/**
 * Filtro por categoría: `''` = todas, `'none'` = sin categoría, o el `id` de una
 * categoría (incluye sus subcategorías).
 */
export function matchesCategoryFilter(
  index: CatalogIndex,
  nodeId: string,
  filter: string,
): boolean {
  if (filter === '') {
    return true;
  }
  const categoryId = index.entryFor(nodeId)?.categoryId ?? null;
  if (filter === 'none') {
    return categoryId === null;
  }
  return categoryId !== null && (categoryId === filter || index.rootOf(categoryId) === filter);
}

export interface CategoryFilterGroup {
  label: string;
  options: { value: string; label: string }[];
}

/** Opciones del filtro: un `optgroup` por categoría con ella misma y sus subcategorías. */
export function categoryFilterGroups(
  categories: readonly VariableCategory[],
): CategoryFilterGroup[] {
  return buildCategoryTree(categories).map(({ category, children }) => ({
    label: category.name,
    options: [
      {
        value: category.id,
        label: children.length > 0 ? `${category.name} (todas)` : category.name,
      },
      ...children.map((child) => ({ value: child.id, label: child.name })),
    ],
  }));
}

/**
 * Ordena según el CSV (que ya agrupa por categoría): primero las categorizadas,
 * después las del catálogo sin categoría y al final las que no están en él.
 * Estable para las que empatan.
 */
export function sortByCatalog<T extends { nodeId?: string }>(
  items: readonly T[],
  index: CatalogIndex,
): T[] {
  const rank = (item: T): [number, number] => {
    const entry = index.entryFor(item.nodeId);
    if (!entry) return [2, 0];
    return [entry.categoryId === null ? 1 : 0, entry.position];
  };
  return items
    .map((item, order) => ({ item, order, rank: rank(item) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.order - b.order)
    .map(({ item }) => item);
}

/** Contenido del fichero: UTF-8 (sin BOM) o, si no es válido, Windows-1252 como exporta CODESYS. */
export function decodeCsvFile(buffer: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  const BYTE_ORDER_MARK = 0xfeff;
  return text.charCodeAt(0) === BYTE_ORDER_MARK ? text.slice(1) : text;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** «8 categorías, 16 subcategorías y 428 variables (20 sin categoría).» */
export function importSummaryText(summary: ImportVariableCategoriesSummary): string {
  const text =
    `${plural(summary.categories, 'categoría', 'categorías')}, ` +
    `${plural(summary.subcategories, 'subcategoría', 'subcategorías')} y ` +
    plural(summary.variables, 'variable', 'variables');
  return summary.uncategorized > 0
    ? `${text} (${summary.uncategorized} sin categoría).`
    : `${text}.`;
}

const ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['VARIABLE_CATEGORY_NAME_TAKEN', 'Ya hay otra categoría con ese nombre en el mismo nivel.'],
  ['INVALID_VARIABLE_CATEGORY_NAME', 'El nombre debe tener entre 1 y 120 caracteres.'],
  ['VARIABLE_CATEGORY_NOT_FOUND', 'La categoría ya no existe. Recarga la página.'],
  ['MACHINE_NOT_FOUND', 'La Machine no existe o no tienes acceso.'],
  ['MACHINE_INACTIVE', 'La Machine está desactivada.'],
]);

export function categoryErrorMessage(error: ApiError): string {
  if (error.code === 'INVALID_GVL_EXPORT') {
    const reason = (error.details as { reason?: string } | undefined)?.reason;
    return reason ?? 'El CSV no es válido.';
  }
  return (
    ERROR_MESSAGES.get(error.code) ?? 'No se ha podido completar la operación. Inténtalo de nuevo.'
  );
}

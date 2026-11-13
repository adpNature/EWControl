/**
 * docs/specs/23-categorias-variables-plc.md: categorías de variables del PLC de
 * una Machine y catálogo de variables importados de la exportación CSV de la GVL.
 * Interfaces TS puras, sin imports de Angular.
 */
export interface VariableCategory {
  id: string;
  /** `null` en las categorías raíz. */
  parentId: string | null;
  name: string;
  position: number;
  /** Variables de la categoría; en las raíz, también las de sus subcategorías. */
  variableCount: number;
}

export interface VariableCatalogEntry {
  nodeId: string;
  categoryId: string | null;
  /** Descripción del CSV (comentario sin marco). */
  comment: string | null;
  position: number;
}

/** Respuesta de `GET /machines/:machineId/variable-categories`. */
export interface VariableCategoryList {
  categories: VariableCategory[];
  variables: VariableCatalogEntry[];
}

/** Respuesta de `POST /machines/:machineId/variable-categories/import`. */
export interface ImportVariableCategoriesSummary {
  categories: number;
  subcategories: number;
  variables: number;
  categorized: number;
  uncategorized: number;
  withComment: number;
}

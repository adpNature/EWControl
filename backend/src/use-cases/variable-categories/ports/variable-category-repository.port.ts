import type { VariableCatalogEntry } from '../../../entities/variable-catalog-entry.entity';
import type { VariableCategory } from '../../../entities/variable-category.entity';
import type { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const VARIABLE_CATEGORY_REPOSITORY = Symbol('VariableCategoryRepository');

/** Categoría a crear; `key`/`parentKey` enlazan padre e hija antes de tener `id`. */
export type NewVariableCategory = {
  key: number;
  parentKey: number | null;
  name: string;
  position: number;
};

/** Entrada del catálogo a crear; `categoryKey` referencia una `NewVariableCategory`. */
export type NewVariableCatalogEntry = {
  nodeId: string;
  categoryKey: number | null;
  comment: string | null;
  position: number;
};

/** docs/specs/23-categorias-variables-plc.md: persistencia de categorías y catálogo de una Machine. */
export interface IVariableCategoryRepository {
  /**
   * Borra las categorías y el catálogo de la Machine y crea los nuevos.
   * Debe llamarse dentro de una transacción.
   */
  replaceForMachine(
    machineId: string,
    categories: readonly NewVariableCategory[],
    entries: readonly NewVariableCatalogEntry[],
    ctx: TransactionContext,
  ): Promise<void>;
  /** Categorías de la Machine ordenadas por `position`. */
  listCategories(machineId: string, ctx: TransactionContext): Promise<VariableCategory[]>;
  /** Catálogo de la Machine ordenado por `position`. */
  listEntries(machineId: string, ctx: TransactionContext): Promise<VariableCatalogEntry[]>;
  /** Categoría con ese `id` dentro de esa Machine, o `null`. */
  findCategory(
    machineId: string,
    categoryId: string,
    ctx: TransactionContext,
  ): Promise<VariableCategory | null>;
  rename(categoryId: string, name: string, ctx: TransactionContext): Promise<VariableCategory>;
}

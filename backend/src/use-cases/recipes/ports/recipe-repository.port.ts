import type { Recipe } from '../../../entities/recipe.entity';
import type { RecipeValueEntry } from '../../../entities/recipe.vo';
import type { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const RECIPE_REPOSITORY = Symbol('RecipeRepository');

/** Contenido editable de una receta, con sus claves normalizadas ya calculadas. */
export type RecipeContent = {
  title: string;
  titleKey: string;
  description: string | null;
  searchKey: string;
  values: RecipeValueEntry[];
};

export type RecipeListQuery = {
  /** Texto ya normalizado que debe contener el título o la descripción. */
  search?: string;
  limit: number;
  offset: number;
};

/** docs/specs/25-recetas.md: persistencia de recetas. */
export interface IRecipeRepository {
  countByMachine(machineId: string, ctx: TransactionContext): Promise<number>;
  findById(id: string, ctx: TransactionContext): Promise<Recipe | null>;
  /** Receta de la Machine con ese título normalizado, o `null`. */
  findByTitleKey(
    machineId: string,
    titleKey: string,
    ctx: TransactionContext,
  ): Promise<Recipe | null>;
  /** Primero la activa y después por `updatedAt` descendente. */
  list(
    machineId: string,
    query: RecipeListQuery,
    ctx: TransactionContext,
  ): Promise<{ data: Recipe[]; total: number }>;
  /** @throws RecipeTitleTakenError si otra petición simultánea ya usó el título. */
  create(
    data: RecipeContent & { machineId: string; actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe>;
  /**
   * Sustituye el contenido solo si la receta sigue en `expectedVersion`, y sube la versión.
   * @returns `null` si la versión ya no coincide (edición simultánea).
   * @throws RecipeTitleTakenError si otra petición simultánea ya usó el título.
   */
  update(
    id: string,
    expectedVersion: number,
    data: RecipeContent & { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe | null>;
  delete(id: string, ctx: TransactionContext): Promise<void>;
  /**
   * Marca la receta como activa y desmarca la que lo estuviera en su Machine.
   * Serializa las activaciones de una misma Machine (bloquea su fila).
   */
  activate(
    machineId: string,
    id: string,
    by: { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe>;
  deactivate(id: string, ctx: TransactionContext): Promise<Recipe>;
}

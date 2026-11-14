import type { RecipeTemplate } from '../../../entities/recipe-template.entity';
import type { RecipeTemplateContent } from '../../../entities/recipe-template.vo';
import type { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const RECIPE_TEMPLATE_REPOSITORY = Symbol('RecipeTemplateRepository');

/** docs/specs/26-receta-base.md: persistencia de la receta base (una por Machine). */
export interface IRecipeTemplateRepository {
  /** La receta base guardada de la Machine, o `null` si usa la por defecto. */
  findByMachineId(machineId: string, ctx: TransactionContext): Promise<RecipeTemplate | null>;
  /**
   * Guarda la receta base solo si sigue en `expectedVersion` (0 = todavía no
   * existe: la crea) y sube la versión.
   * @returns `null` si la versión ya no coincide (edición simultánea).
   */
  save(
    machineId: string,
    expectedVersion: number,
    content: RecipeTemplateContent,
    by: { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<RecipeTemplate | null>;
}

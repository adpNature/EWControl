import { Inject, Injectable } from '@nestjs/common';
import type { Machine } from '../../entities/machine.entity';
import type { Recipe } from '../../entities/recipe.entity';
import { buildRecipeVariableSet, type RecipeVariableSet } from '../../entities/recipe.vo';
import {
  MachineAccessResolver,
  type Requester,
} from '../machine-management/machine-access.resolver';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import {
  type IVariableCategoryRepository,
  VARIABLE_CATEGORY_REPOSITORY,
} from '../variable-categories/ports/variable-category-repository.port';
import { RecipeNotFoundError } from './errors/recipe-not-found.error';
import { type IRecipeRepository, RECIPE_REPOSITORY } from './ports/recipe-repository.port';

export type MachineWithRecipeVariables = { machine: Machine; variableSet: RecipeVariableSet };

/**
 * Acceso común de docs/specs/25-recetas.md: la Machine activa del requester
 * (otra Company o inactiva: `404`, como el resto de la API), sus variables de
 * receta actuales y, en su caso, la receta, que debe pertenecer a esa Machine.
 */
@Injectable()
export class RecipeAccessResolver {
  constructor(
    private readonly machineAccessResolver: MachineAccessResolver,
    @Inject(VARIABLE_CATEGORY_REPOSITORY)
    private readonly categoryRepository: IVariableCategoryRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly connectionRepository: IMachineConnectionRepository,
    @Inject(RECIPE_REPOSITORY) private readonly recipeRepository: IRecipeRepository,
  ) {}

  /** @throws MachineNotFoundError */
  async resolveMachine(
    machineId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<MachineWithRecipeVariables> {
    const machine = await this.machineAccessResolver.resolveActive(machineId, requester, ctx);
    const [categories, entries, connection] = await Promise.all([
      this.categoryRepository.listCategories(machine.id, ctx),
      this.categoryRepository.listEntries(machine.id, ctx),
      this.connectionRepository.findByMachineId(machine.id, ctx),
    ]);
    return {
      machine,
      variableSet: buildRecipeVariableSet(
        categories,
        entries,
        connection?.connectionConfig ?? null,
      ),
    };
  }

  /** @throws RecipeNotFoundError si no existe o es de otra Machine. */
  async resolveRecipe(
    machineId: string,
    recipeId: string,
    ctx: TransactionContext,
  ): Promise<Recipe> {
    const recipe = await this.recipeRepository.findById(recipeId, ctx);
    if (!recipe || recipe.machineId !== machineId) {
      throw new RecipeNotFoundError(recipeId);
    }
    return recipe;
  }
}

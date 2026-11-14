import { Inject, Injectable } from '@nestjs/common';
import type { Machine } from '../../entities/machine.entity';
import type { RecipeTemplate } from '../../entities/recipe-template.entity';
import {
  type RecipeTemplateContent,
  type ResolvedRecipeTemplate,
  resolveRecipeTemplate,
} from '../../entities/recipe-template.vo';
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
import {
  type IRecipeTemplateRepository,
  RECIPE_TEMPLATE_REPOSITORY,
} from './ports/recipe-template-repository.port';

export type MachineWithRecipeVariables = {
  machine: Machine;
  variableSet: RecipeVariableSet;
  /** Receta base guardada, o `null` si la Machine usa la por defecto (spec 26). */
  storedTemplate: RecipeTemplate | null;
  /** Receta base aplicada a las variables actuales. */
  template: ResolvedRecipeTemplate;
};

/**
 * Acceso común de docs/specs/25-recetas.md: la Machine activa del requester
 * (otra Company o inactiva: `404`, como el resto de la API), sus variables de
 * receta actuales, su receta base (docs/specs/26-receta-base.md) y, en su caso,
 * la receta, que debe pertenecer a esa Machine.
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
    @Inject(RECIPE_TEMPLATE_REPOSITORY)
    private readonly templateRepository: IRecipeTemplateRepository,
  ) {}

  /** @throws MachineNotFoundError */
  async resolveMachine(
    machineId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<MachineWithRecipeVariables> {
    const machine = await this.machineAccessResolver.resolveActive(machineId, requester, ctx);
    const [categories, entries, connection, storedTemplate] = await Promise.all([
      this.categoryRepository.listCategories(machine.id, ctx),
      this.categoryRepository.listEntries(machine.id, ctx),
      this.connectionRepository.findByMachineId(machine.id, ctx),
      this.templateRepository.findByMachineId(machine.id, ctx),
    ]);
    const variableSet = buildRecipeVariableSet(
      categories,
      entries,
      connection?.connectionConfig ?? null,
    );
    return {
      machine,
      variableSet,
      storedTemplate,
      template: resolveRecipeTemplate(templateContentOf(storedTemplate), variableSet.variables),
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

/** Contenido de una receta base guardada, o `null` si no hay (se usa la por defecto). */
export function templateContentOf(template: RecipeTemplate | null): RecipeTemplateContent | null {
  return template ? { variables: template.variables, layout: template.layout } : null;
}

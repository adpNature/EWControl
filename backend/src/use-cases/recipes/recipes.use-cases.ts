import { Inject, Injectable } from '@nestjs/common';
import type { Recipe } from '../../entities/recipe.entity';
import {
  assessRecipe,
  MAX_RECIPES_PER_MACHINE,
  normalizeForComparison,
  type RecipeAssessment,
  recipeSearchKey,
  type RecipeValueEntry,
  type RecipeVariable,
  type RecipeVariableSet,
  validateRecipeValues,
} from '../../entities/recipe.vo';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import type { Requester } from '../machine-management/machine-access.resolver';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { InvalidRecipeValuesError } from './errors/invalid-recipe-values.error';
import { RecipeIncompleteError } from './errors/recipe-incomplete.error';
import { RecipeLimitReachedError } from './errors/recipe-limit-reached.error';
import { RecipeModifiedError } from './errors/recipe-modified.error';
import { RecipeTitleTakenError } from './errors/recipe-title-taken.error';
import { RecipeVariablesNotAvailableError } from './errors/recipe-variables-not-available.error';
import {
  type IRecipeRepository,
  RECIPE_REPOSITORY,
  type RecipeContent,
} from './ports/recipe-repository.port';
import { RecipeAccessResolver } from './recipe-access.resolver';

export type RecipeMachineRef = { machineId: string; requester: Requester };
export type RecipeRef = RecipeMachineRef & { recipeId: string };

export type RecipeInput = {
  title: string;
  description?: string | null;
  values: RecipeValueEntry[];
};

/** Fila del listado (spec 25, "Listado y buscador"). */
export type RecipeSummary = Pick<
  Recipe,
  'id' | 'title' | 'description' | 'isActivated' | 'activatedAt' | 'updatedAt' | 'updatedByEmail'
> & { isComplete: boolean };

/** Receta completa tal como la devuelve la API: valores vigentes y, si procede, lo que falta o sobra. */
export type RecipeView = Omit<Recipe, 'machine' | 'titleKey' | 'searchKey'> & RecipeAssessment;

export type RecipePage = { data: RecipeSummary[]; total: number; limit: number; offset: number };

/** spec 25, criterio backend 1: variables de receta de la Machine, para los tres roles. */
@Injectable()
export class GetRecipeVariablesUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: RecipeMachineRef): Promise<RecipeVariableSet> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      return variableSet;
    });
  }
}

/** spec 25, criterio backend 5: listado paginado con buscador sin mayúsculas ni tildes. */
@Injectable()
export class ListRecipesUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(
    input: RecipeMachineRef & { search?: string; limit: number; offset: number },
  ): Promise<RecipePage> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const search = input.search ? normalizeForComparison(input.search) : '';
      const page = await this.repository.list(
        machine.id,
        { ...(search ? { search } : {}), limit: input.limit, offset: input.offset },
        ctx,
      );
      return {
        data: page.data.map((recipe) => toSummary(recipe, variableSet.variables)),
        total: page.total,
        limit: input.limit,
        offset: input.offset,
      };
    });
  }
}

@Injectable()
export class GetRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws RecipeNotFoundError / MachineNotFoundError */
  execute(input: RecipeRef): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const recipe = await this.access.resolveRecipe(machine.id, input.recipeId, ctx);
      return toView(recipe, variableSet.variables);
    });
  }
}

/** spec 25, criterios backend 3 y 4: alta con todos los valores obligatorios y validados. */
@Injectable()
export class CreateRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  /**
   * @throws RecipeVariablesNotAvailableError / InvalidRecipeValuesError /
   *   RecipeTitleTakenError / RecipeLimitReachedError / MachineNotFoundError
   */
  execute(input: RecipeMachineRef & RecipeInput & { actorEmail: string }): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const content = buildContent(machine.id, input, variableSet);
      await assertTitleAvailable(this.repository, machine.id, content, null, ctx);
      if ((await this.repository.countByMachine(machine.id, ctx)) >= MAX_RECIPES_PER_MACHINE) {
        throw new RecipeLimitReachedError(MAX_RECIPES_PER_MACHINE);
      }
      const recipe = await this.repository.create(
        { ...content, machineId: machine.id, actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      return toView(recipe, variableSet.variables);
    });
  }
}

/** spec 25, criterios backend 4 y 7: edición con la misma validación y control de versión. */
@Injectable()
export class UpdateRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  /**
   * @throws RecipeVariablesNotAvailableError / InvalidRecipeValuesError /
   *   RecipeTitleTakenError / RecipeModifiedError / RecipeNotFoundError / MachineNotFoundError
   */
  execute(
    input: RecipeRef & RecipeInput & { version: number; actorEmail: string },
  ): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const current = await this.access.resolveRecipe(machine.id, input.recipeId, ctx);
      if (current.version !== input.version) {
        throw new RecipeModifiedError(current.id);
      }
      const content = buildContent(machine.id, input, variableSet);
      await assertTitleAvailable(this.repository, machine.id, content, current.id, ctx);
      const updated = await this.repository.update(
        current.id,
        input.version,
        { ...content, actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      if (!updated) {
        throw new RecipeModifiedError(current.id);
      }
      return toView(updated, variableSet.variables);
    });
  }
}

/** Borrado físico: no hay papelera ni historial (spec 25, "Modelo"). */
@Injectable()
export class DeleteRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws RecipeNotFoundError / MachineNotFoundError */
  execute(input: RecipeRef): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine } = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const recipe = await this.access.resolveRecipe(machine.id, input.recipeId, ctx);
      await this.repository.delete(recipe.id, ctx);
    });
  }
}

/**
 * spec 25, criterio backend 6: marca la receta como activa (y desmarca la
 * anterior de la Machine). Solo una marca: no se comunica con el PLC ni publica eventos.
 */
@Injectable()
export class ActivateRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  /** @throws RecipeIncompleteError / RecipeNotFoundError / MachineNotFoundError */
  execute(input: RecipeRef & { actorEmail: string }): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const recipe = await this.access.resolveRecipe(machine.id, input.recipeId, ctx);
      if (recipe.isActivated) {
        return toView(recipe, variableSet.variables);
      }
      if (!assessRecipe(recipe.values, variableSet.variables).isComplete) {
        throw new RecipeIncompleteError(recipe.id);
      }
      const activated = await this.repository.activate(
        machine.id,
        recipe.id,
        { actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      return toView(activated, variableSet.variables);
    });
  }
}

/** spec 25: quita la marca «Activa»; la Machine se queda sin receta activa. */
@Injectable()
export class DeactivateRecipeUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly repository: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws RecipeNotFoundError / MachineNotFoundError */
  execute(input: RecipeRef): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, variableSet } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const recipe = await this.access.resolveRecipe(machine.id, input.recipeId, ctx);
      const result = recipe.isActivated ? await this.repository.deactivate(recipe.id, ctx) : recipe;
      return toView(result, variableSet.variables);
    });
  }
}

/** Valida la entrada contra las variables de receta y la convierte en contenido persistible. */
function buildContent(
  machineId: string,
  input: RecipeInput,
  variableSet: RecipeVariableSet,
): RecipeContent {
  if (variableSet.variables.length === 0) {
    throw new RecipeVariablesNotAvailableError(machineId);
  }
  const issues = validateRecipeValues(input.values, variableSet.variables);
  if (issues.length > 0) {
    throw new InvalidRecipeValuesError(issues);
  }
  const byName = new Map(input.values.map((entry) => [entry.signalVariableName, entry.value]));
  const title = input.title.trim();
  const description = input.description?.trim() ? input.description.trim() : null;
  return {
    title,
    titleKey: normalizeForComparison(title),
    description,
    searchKey: recipeSearchKey(title, description),
    // Se guardan en el orden de la GVL, como se muestran.
    values: variableSet.variables.map((variable) => ({
      signalVariableName: variable.signalVariableName,
      value: byName.get(variable.signalVariableName) as RecipeValueEntry['value'],
    })),
  };
}

async function assertTitleAvailable(
  repository: IRecipeRepository,
  machineId: string,
  content: RecipeContent,
  ownId: string | null,
  ctx: TransactionContext,
): Promise<void> {
  const existing = await repository.findByTitleKey(machineId, content.titleKey, ctx);
  if (existing && existing.id !== ownId) {
    throw new RecipeTitleTakenError(content.title);
  }
}

function toView(recipe: Recipe, variables: readonly RecipeVariable[]): RecipeView {
  return {
    id: recipe.id,
    machineId: recipe.machineId,
    title: recipe.title,
    description: recipe.description,
    isActivated: recipe.isActivated,
    activatedAt: recipe.activatedAt,
    activatedByEmail: recipe.activatedByEmail,
    version: recipe.version,
    createdAt: recipe.createdAt,
    createdByEmail: recipe.createdByEmail,
    updatedAt: recipe.updatedAt,
    updatedByEmail: recipe.updatedByEmail,
    ...assessRecipe(recipe.values, variables),
  };
}

function toSummary(recipe: Recipe, variables: readonly RecipeVariable[]): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    isActivated: recipe.isActivated,
    activatedAt: recipe.activatedAt,
    updatedAt: recipe.updatedAt,
    updatedByEmail: recipe.updatedByEmail,
    isComplete: assessRecipe(recipe.values, variables).isComplete,
  };
}

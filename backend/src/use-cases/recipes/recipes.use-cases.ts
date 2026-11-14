import { Inject, Injectable } from '@nestjs/common';
import {
  buildRecipeForm,
  type EffectiveRecipeValue,
  effectiveRecipeValues,
  type RecipeFormDefinition,
  type ResolvedRecipeTemplate,
} from '../../entities/recipe-template.vo';
import type { Recipe } from '../../entities/recipe.entity';
import {
  assessRecipe,
  MAX_RECIPES_PER_MACHINE,
  normalizeForComparison,
  type RecipeAssessment,
  recipeSearchKey,
  type RecipeValueEntry,
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
import { RecipeTemplateInvalidError } from './errors/recipe-template-invalid.error';
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

/**
 * Receta completa tal como la devuelve la API: valores vigentes y, si procede,
 * lo que falta o sobra, y lo que llegaría a la máquina (spec 26).
 */
export type RecipeView = Omit<Recipe, 'machine' | 'titleKey' | 'searchKey'> &
  RecipeAssessment & { effectiveValues: EffectiveRecipeValue[] | null };

/** Contexto de evaluación de una receta: variables de receta y receta base en vigor. */
type RecipeContext = { variableSet: RecipeVariableSet; template: ResolvedRecipeTemplate };

export type RecipePage = { data: RecipeSummary[]; total: number; limit: number; offset: number };

/**
 * spec 25, criterio backend 1, ampliado por la spec 26 (criterio backend 10):
 * lo que necesita el formulario de recetas, para los tres roles.
 */
@Injectable()
export class GetRecipeVariablesUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: RecipeMachineRef): Promise<RecipeFormDefinition> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { variableSet, template } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      return buildRecipeForm(variableSet, template);
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
      const { machine, template } = await this.access.resolveMachine(
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
        data: page.data.map((recipe) => toSummary(recipe, template)),
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
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const recipe = await this.access.resolveRecipe(resolved.machine.id, input.recipeId, ctx);
      return toView(recipe, resolved);
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
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const machineId = resolved.machine.id;
      const content = buildContent(machineId, input, resolved);
      await assertTitleAvailable(this.repository, machineId, content, null, ctx);
      if ((await this.repository.countByMachine(machineId, ctx)) >= MAX_RECIPES_PER_MACHINE) {
        throw new RecipeLimitReachedError(MAX_RECIPES_PER_MACHINE);
      }
      const recipe = await this.repository.create(
        { ...content, machineId, actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      return toView(recipe, resolved);
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
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const machineId = resolved.machine.id;
      const current = await this.access.resolveRecipe(machineId, input.recipeId, ctx);
      if (current.version !== input.version) {
        throw new RecipeModifiedError(current.id);
      }
      const content = buildContent(machineId, input, resolved);
      await assertTitleAvailable(this.repository, machineId, content, current.id, ctx);
      const updated = await this.repository.update(
        current.id,
        input.version,
        { ...content, actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      if (!updated) {
        throw new RecipeModifiedError(current.id);
      }
      return toView(updated, resolved);
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

  /**
   * @throws RecipeIncompleteError / RecipeTemplateInvalidError (spec 26) /
   *   RecipeNotFoundError / MachineNotFoundError
   */
  execute(input: RecipeRef & { actorEmail: string }): Promise<RecipeView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const recipe = await this.access.resolveRecipe(resolved.machine.id, input.recipeId, ctx);
      if (recipe.isActivated) {
        return toView(recipe, resolved);
      }
      if (!assessRecipe(recipe.values, resolved.template.editableRules).isComplete) {
        throw new RecipeIncompleteError(recipe.id);
      }
      if (!resolved.template.isValid) {
        throw new RecipeTemplateInvalidError(resolved.machine.id);
      }
      const activated = await this.repository.activate(
        resolved.machine.id,
        recipe.id,
        { actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      return toView(activated, resolved);
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
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const recipe = await this.access.resolveRecipe(resolved.machine.id, input.recipeId, ctx);
      const result = recipe.isActivated ? await this.repository.deactivate(recipe.id, ctx) : recipe;
      return toView(result, resolved);
    });
  }
}

/**
 * Valida la entrada contra las variables editables de la receta base (spec 26)
 * y la convierte en contenido persistible.
 */
function buildContent(
  machineId: string,
  input: RecipeInput,
  { variableSet, template }: RecipeContext,
): RecipeContent {
  if (variableSet.variables.length === 0) {
    throw new RecipeVariablesNotAvailableError(machineId);
  }
  const issues = validateRecipeValues(
    input.values,
    template.editableRules,
    template.nonEditableNames,
  );
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
    // Solo las editables, en el orden de la GVL: los valores de variables que
    // ya no son editables desaparecen al guardar (spec 26, "Valores de más").
    values: template.editableRules.map((rule) => ({
      signalVariableName: rule.signalVariableName,
      value: byName.get(rule.signalVariableName) as RecipeValueEntry['value'],
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

function toView(recipe: Recipe, { variableSet, template }: RecipeContext): RecipeView {
  const assessment = assessRecipe(recipe.values, template.editableRules);
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
    ...assessment,
    effectiveValues: effectiveRecipeValues(
      variableSet.variables,
      assessment.values,
      assessment.isComplete,
      template,
    ),
  };
}

function toSummary(recipe: Recipe, template: ResolvedRecipeTemplate): RecipeSummary {
  return {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description,
    isActivated: recipe.isActivated,
    activatedAt: recipe.activatedAt,
    updatedAt: recipe.updatedAt,
    updatedByEmail: recipe.updatedByEmail,
    isComplete: assessRecipe(recipe.values, template.editableRules).isComplete,
  };
}

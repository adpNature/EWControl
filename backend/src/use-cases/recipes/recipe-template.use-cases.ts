import { Inject, Injectable } from '@nestjs/common';
import {
  type BooleanLabels,
  computeTemplateImpact,
  type RecipeLayout,
  type RecipeTemplateContent,
  type RecipeVariableConfig,
  resolveRecipeTemplate,
  type StaleTemplateConfig,
  suggestFromComment,
  type TemplateImpact,
  validateTemplateContent,
} from '../../entities/recipe-template.vo';
import type { RecipeOption } from '../../entities/recipe.vo';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { InvalidRecipeTemplateError } from './errors/invalid-recipe-template.error';
import { RecipeTemplateModifiedError } from './errors/recipe-template-modified.error';
import { RecipeVariablesNotAvailableError } from './errors/recipe-variables-not-available.error';
import { type IRecipeRepository, RECIPE_REPOSITORY } from './ports/recipe-repository.port';
import {
  type IRecipeTemplateRepository,
  RECIPE_TEMPLATE_REPOSITORY,
} from './ports/recipe-template-repository.port';
import {
  type MachineWithRecipeVariables,
  RecipeAccessResolver,
  templateContentOf,
} from './recipe-access.resolver';
import type { RecipeMachineRef } from './recipes.use-cases';

/** Una variable de receta en la pantalla de la receta base (spec 26, `GET …/recipe-template`). */
export type RecipeTemplateVariableView = {
  signalVariableName: string;
  dataType: string;
  comment: string | null;
  mappingMin: number | null;
  mappingMax: number | null;
  isUnconfigured: boolean;
  suggestedOptions: RecipeOption[] | null;
  suggestedBooleanLabels: BooleanLabels | null;
  config: Omit<RecipeVariableConfig, 'signalVariableName'>;
};

export type RecipeTemplateView = {
  category: { id: string; name: string } | null;
  isDefault: boolean;
  version: number;
  updatedAt: Date | null;
  updatedByEmail: string | null;
  variables: RecipeTemplateVariableView[];
  layout: RecipeLayout;
  removedVariables: string[];
  staleConfig: StaleTemplateConfig[];
  excludedCount: number;
};

/** spec 26, criterio backend 1: la receta base en vigor (o la por defecto), solo para administradores. */
@Injectable()
export class GetRecipeTemplateUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws MachineNotFoundError */
  execute(input: RecipeMachineRef): Promise<RecipeTemplateView> {
    return this.unitOfWork.runInTransaction(async (ctx) =>
      toTemplateView(await this.access.resolveMachine(input.machineId, input.requester, ctx)),
    );
  }
}

/** spec 26, criterios backend 2 y 3: guarda la receta base validada, con control de versión. */
@Injectable()
export class SaveRecipeTemplateUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_TEMPLATE_REPOSITORY) private readonly repository: IRecipeTemplateRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  /**
   * No modifica ninguna receta: las que dejan de estar completas se detectan al leerlas.
   * @throws RecipeVariablesNotAvailableError / InvalidRecipeTemplateError /
   *   RecipeTemplateModifiedError / MachineNotFoundError
   */
  execute(
    input: RecipeMachineRef & {
      content: RecipeTemplateContent;
      version: number;
      actorEmail: string;
    },
  ): Promise<RecipeTemplateView> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const machineId = resolved.machine.id;
      assertValid(resolved, input.content);
      if ((resolved.storedTemplate?.version ?? 0) !== input.version) {
        throw new RecipeTemplateModifiedError(machineId);
      }
      const saved = await this.repository.save(
        machineId,
        input.version,
        input.content,
        { actorEmail: input.actorEmail, at: this.clock.now() },
        ctx,
      );
      if (!saved) {
        throw new RecipeTemplateModifiedError(machineId);
      }
      return toTemplateView({
        ...resolved,
        storedTemplate: saved,
        template: resolveRecipeTemplate(templateContentOf(saved), resolved.variableSet.variables),
      });
    });
  }
}

/** spec 26, criterio backend 4: cuántas recetas pasarían a incompletas, sin guardar nada. */
@Injectable()
export class PreviewRecipeTemplateImpactUseCase {
  constructor(
    private readonly access: RecipeAccessResolver,
    @Inject(RECIPE_REPOSITORY) private readonly recipes: IRecipeRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws RecipeVariablesNotAvailableError / InvalidRecipeTemplateError / MachineNotFoundError */
  execute(input: RecipeMachineRef & { content: RecipeTemplateContent }): Promise<TemplateImpact> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      assertValid(resolved, input.content);
      const proposed = resolveRecipeTemplate(input.content, resolved.variableSet.variables);
      const recipes = await this.recipes.listAllByMachine(resolved.machine.id, ctx);
      return computeTemplateImpact(
        recipes,
        resolved.template.editableRules,
        proposed.editableRules,
      );
    });
  }
}

function assertValid(resolved: MachineWithRecipeVariables, content: RecipeTemplateContent): void {
  if (resolved.variableSet.variables.length === 0) {
    throw new RecipeVariablesNotAvailableError(resolved.machine.id);
  }
  const issues = validateTemplateContent(content, resolved.variableSet.variables);
  if (issues.length > 0) {
    throw new InvalidRecipeTemplateError(issues);
  }
}

function toTemplateView({
  variableSet,
  storedTemplate,
  template,
}: MachineWithRecipeVariables): RecipeTemplateView {
  const configs = new Map(template.configs.map((config) => [config.signalVariableName, config]));
  const unconfigured = new Set(template.unconfiguredVariables);
  return {
    category: variableSet.category,
    isDefault: template.isDefault,
    version: storedTemplate?.version ?? 0,
    updatedAt: storedTemplate?.updatedAt ?? null,
    updatedByEmail: storedTemplate?.updatedByEmail ?? null,
    variables: variableSet.variables.map((variable) => {
      const config: Partial<RecipeVariableConfig> = {
        ...(configs.get(variable.signalVariableName) as RecipeVariableConfig),
      };
      delete config.signalVariableName;
      const suggestion = suggestFromComment(variable.comment, variable.dataType);
      return {
        signalVariableName: variable.signalVariableName,
        dataType: variable.dataType,
        comment: variable.comment,
        mappingMin: variable.min,
        mappingMax: variable.max,
        isUnconfigured: unconfigured.has(variable.signalVariableName),
        suggestedOptions: suggestion.options,
        suggestedBooleanLabels: suggestion.booleanLabels,
        config: config as RecipeTemplateVariableView['config'],
      };
    }),
    layout: template.layout,
    removedVariables: template.removedVariables,
    staleConfig: template.staleConfig,
    excludedCount: variableSet.excludedCount,
  };
}

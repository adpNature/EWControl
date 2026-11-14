import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import type { RecipeVariableSet } from '../../../entities/recipe.vo';
import { UserRole } from '../../../entities/user-role.enum';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { InvalidRecipeValuesError } from '../../../use-cases/recipes/errors/invalid-recipe-values.error';
import { RecipeIncompleteError } from '../../../use-cases/recipes/errors/recipe-incomplete.error';
import { RecipeLimitReachedError } from '../../../use-cases/recipes/errors/recipe-limit-reached.error';
import { RecipeModifiedError } from '../../../use-cases/recipes/errors/recipe-modified.error';
import { RecipeNotFoundError } from '../../../use-cases/recipes/errors/recipe-not-found.error';
import { RecipeTitleTakenError } from '../../../use-cases/recipes/errors/recipe-title-taken.error';
import { RecipeVariablesNotAvailableError } from '../../../use-cases/recipes/errors/recipe-variables-not-available.error';
import {
  ActivateRecipeUseCase,
  CreateRecipeUseCase,
  DeactivateRecipeUseCase,
  DeleteRecipeUseCase,
  GetRecipeUseCase,
  GetRecipeVariablesUseCase,
  ListRecipesUseCase,
  type RecipePage,
  type RecipeView,
  UpdateRecipeUseCase,
} from '../../../use-cases/recipes/recipes.use-cases';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { roles } from '../../auth-guard/roles.decorator';
import { CreateRecipeDto, ListRecipesQueryDto, UpdateRecipeDto } from './recipe.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/**
 * docs/specs/25-recetas.md, sección "Contrato". Todas las rutas son de los tres
 * roles a propósito: el `Operador` también crea, edita, borra y activa recetas.
 */
@roles(UserRole.SuperAdmin, UserRole.AdminCliente, UserRole.Operador)
@Controller('machines/:machineId')
export class RecipeController {
  constructor(
    private readonly getRecipeVariables: GetRecipeVariablesUseCase,
    private readonly listRecipes: ListRecipesUseCase,
    private readonly getRecipe: GetRecipeUseCase,
    private readonly createRecipe: CreateRecipeUseCase,
    private readonly updateRecipe: UpdateRecipeUseCase,
    private readonly deleteRecipe: DeleteRecipeUseCase,
    private readonly activateRecipe: ActivateRecipeUseCase,
    private readonly deactivateRecipe: DeactivateRecipeUseCase,
  ) {}

  @Get('recipe-variables')
  variables(
    @Param('machineId') machineId: string,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeVariableSet> {
    return run(() => this.getRecipeVariables.execute({ machineId, requester: requesterOf(user) }));
  }

  @Get('recipes')
  list(
    @Param('machineId') machineId: string,
    @Query() query: ListRecipesQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<RecipePage> {
    return run(() =>
      this.listRecipes.execute({
        machineId,
        requester: requesterOf(user),
        ...(query.search !== undefined ? { search: query.search } : {}),
        limit: query.limit ?? DEFAULT_LIMIT,
        offset: query.offset ?? DEFAULT_OFFSET,
      }),
    );
  }

  @Get('recipes/:recipeId')
  get(
    @Param('machineId') machineId: string,
    @Param('recipeId') recipeId: string,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeView> {
    return run(() => this.getRecipe.execute({ machineId, recipeId, requester: requesterOf(user) }));
  }

  @Post('recipes')
  create(
    @Param('machineId') machineId: string,
    @Body() dto: CreateRecipeDto,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeView> {
    return run(() =>
      this.createRecipe.execute({
        machineId,
        requester: requesterOf(user),
        actorEmail: user.email,
        title: dto.title,
        description: dto.description ?? null,
        values: valuesOf(dto),
      }),
    );
  }

  @Put('recipes/:recipeId')
  update(
    @Param('machineId') machineId: string,
    @Param('recipeId') recipeId: string,
    @Body() dto: UpdateRecipeDto,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeView> {
    return run(() =>
      this.updateRecipe.execute({
        machineId,
        recipeId,
        requester: requesterOf(user),
        actorEmail: user.email,
        title: dto.title,
        description: dto.description ?? null,
        values: valuesOf(dto),
        version: dto.version,
      }),
    );
  }

  @Delete('recipes/:recipeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('machineId') machineId: string,
    @Param('recipeId') recipeId: string,
    @currentUser() user: CurrentUser,
  ): Promise<void> {
    return run(() =>
      this.deleteRecipe.execute({ machineId, recipeId, requester: requesterOf(user) }),
    );
  }

  /** Solo una marca: no se comunica con el PLC (spec 25, criterio backend 6). */
  @Post('recipes/:recipeId/activate')
  @HttpCode(HttpStatus.OK)
  activate(
    @Param('machineId') machineId: string,
    @Param('recipeId') recipeId: string,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeView> {
    return run(() =>
      this.activateRecipe.execute({
        machineId,
        recipeId,
        requester: requesterOf(user),
        actorEmail: user.email,
      }),
    );
  }

  @Post('recipes/:recipeId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('machineId') machineId: string,
    @Param('recipeId') recipeId: string,
    @currentUser() user: CurrentUser,
  ): Promise<RecipeView> {
    return run(() =>
      this.deactivateRecipe.execute({ machineId, recipeId, requester: requesterOf(user) }),
    );
  }
}

function requesterOf(user: CurrentUser) {
  return { companyId: user.companyId, role: user.role };
}

function valuesOf(dto: CreateRecipeDto) {
  return dto.values.map(({ signalVariableName, value }) => ({ signalVariableName, value }));
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toHttpException(error);
  }
}

/** Traduce los errores de los casos de uso a los códigos de docs/specs/25-recetas.md. */
export function toHttpException(error: unknown): HttpException {
  if (error instanceof MachineNotFoundError) {
    return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
  }
  if (error instanceof RecipeNotFoundError) {
    return new NotFoundException({ code: 'RECIPE_NOT_FOUND', message: error.message });
  }
  if (error instanceof InvalidRecipeValuesError) {
    return new BadRequestException({
      code: 'INVALID_RECIPE_VALUES',
      message: error.message,
      details: error.issues,
    });
  }
  const conflicts: [new (...args: never[]) => Error, string][] = [
    [RecipeTitleTakenError, 'RECIPE_TITLE_TAKEN'],
    [RecipeModifiedError, 'RECIPE_MODIFIED'],
    [RecipeIncompleteError, 'RECIPE_INCOMPLETE'],
    [RecipeLimitReachedError, 'RECIPE_LIMIT_REACHED'],
    [RecipeVariablesNotAvailableError, 'RECIPE_VARIABLES_NOT_AVAILABLE'],
  ];
  const conflict = conflicts.find(([type]) => error instanceof type);
  if (conflict) {
    return new ConflictException({ code: conflict[1], message: (error as Error).message });
  }
  if (error instanceof HttpException) {
    return error;
  }
  return new InternalServerErrorException();
}

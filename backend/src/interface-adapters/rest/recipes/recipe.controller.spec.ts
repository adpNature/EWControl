import { HttpException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { InvalidRecipeValuesError } from '../../../use-cases/recipes/errors/invalid-recipe-values.error';
import { RecipeIncompleteError } from '../../../use-cases/recipes/errors/recipe-incomplete.error';
import { RecipeLimitReachedError } from '../../../use-cases/recipes/errors/recipe-limit-reached.error';
import { RecipeModifiedError } from '../../../use-cases/recipes/errors/recipe-modified.error';
import { RecipeNotFoundError } from '../../../use-cases/recipes/errors/recipe-not-found.error';
import { RecipeTitleTakenError } from '../../../use-cases/recipes/errors/recipe-title-taken.error';
import { RecipeVariablesNotAvailableError } from '../../../use-cases/recipes/errors/recipe-variables-not-available.error';
import { RecipeController, toHttpException } from './recipe.controller';

const USER = {
  id: 'user-1',
  email: 'operador@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.Operador,
};

function createController() {
  const useCases = {
    variables: {
      execute: vi.fn().mockResolvedValue({ category: null, variables: [], excludedCount: 0 }),
    },
    list: { execute: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 }) },
    get: { execute: vi.fn().mockResolvedValue({ id: 'recipe-1' }) },
    create: { execute: vi.fn().mockResolvedValue({ id: 'recipe-1' }) },
    update: { execute: vi.fn().mockResolvedValue({ id: 'recipe-1' }) },
    remove: { execute: vi.fn().mockResolvedValue(undefined) },
    activate: { execute: vi.fn().mockResolvedValue({ id: 'recipe-1' }) },
    deactivate: { execute: vi.fn().mockResolvedValue({ id: 'recipe-1' }) },
  };
  const controller = new RecipeController(
    useCases.variables as never,
    useCases.list as never,
    useCases.get as never,
    useCases.create as never,
    useCases.update as never,
    useCases.remove as never,
    useCases.activate as never,
    useCases.deactivate as never,
  );
  return { controller, useCases };
}

const REQUESTER = { companyId: 'company-1', role: UserRole.Operador };

describe('RecipeController (docs/specs/25-recetas.md)', () => {
  it('lista con la paginación por defecto y sin búsqueda', async () => {
    const { controller, useCases } = createController();

    await controller.list('machine-1', {}, USER);

    expect(useCases.list.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: REQUESTER,
      limit: 20,
      offset: 0,
    });
  });

  it('pasa la búsqueda y la paginación recibidas', async () => {
    const { controller, useCases } = createController();

    await controller.list('machine-1', { search: 'bob', limit: 5, offset: 10 }, USER);

    expect(useCases.list.execute).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'bob', limit: 5, offset: 10 }),
    );
  });

  it('crea con el email del usuario y solo los campos declarados de cada valor', async () => {
    const { controller, useCases } = createController();

    await controller.create(
      'machine-1',
      {
        title: 'Bobina',
        values: [{ signalVariableName: 'rEspiras', value: 3, extra: 1 } as never],
      },
      USER,
    );

    expect(useCases.create.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: REQUESTER,
      actorEmail: 'operador@ewcontrol.local',
      title: 'Bobina',
      description: null,
      values: [{ signalVariableName: 'rEspiras', value: 3 }],
    });
  });

  it('edita pasando la versión leída', async () => {
    const { controller, useCases } = createController();

    await controller.update(
      'machine-1',
      'recipe-1',
      { title: 'B', description: 'd', values: [], version: 4 },
      USER,
    );

    expect(useCases.update.execute).toHaveBeenCalledWith(
      expect.objectContaining({ recipeId: 'recipe-1', version: 4, description: 'd' }),
    );
  });

  it('consulta, borra, activa y desactiva delegando en su caso de uso', async () => {
    const { controller, useCases } = createController();

    await controller.variables('machine-1', USER);
    await controller.get('machine-1', 'recipe-1', USER);
    await controller.remove('machine-1', 'recipe-1', USER);
    await controller.activate('machine-1', 'recipe-1', USER);
    await controller.deactivate('machine-1', 'recipe-1', USER);

    expect(useCases.variables.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: REQUESTER,
    });
    expect(useCases.get.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      recipeId: 'recipe-1',
      requester: REQUESTER,
    });
    expect(useCases.remove.execute).toHaveBeenCalled();
    expect(useCases.activate.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actorEmail: 'operador@ewcontrol.local' }),
    );
    expect(useCases.deactivate.execute).toHaveBeenCalled();
  });

  it('convierte los errores del caso de uso en la respuesta HTTP', async () => {
    const { controller, useCases } = createController();
    useCases.get.execute.mockRejectedValue(new RecipeNotFoundError('recipe-1'));

    await expect(controller.get('machine-1', 'recipe-1', USER)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('toHttpException', () => {
  it.each([
    [new MachineNotFoundError('m'), 404, 'MACHINE_NOT_FOUND'],
    [new RecipeNotFoundError('r'), 404, 'RECIPE_NOT_FOUND'],
    [new RecipeTitleTakenError('t'), 409, 'RECIPE_TITLE_TAKEN'],
    [new RecipeModifiedError('r'), 409, 'RECIPE_MODIFIED'],
    [new RecipeIncompleteError('r'), 409, 'RECIPE_INCOMPLETE'],
    [new RecipeLimitReachedError(500), 409, 'RECIPE_LIMIT_REACHED'],
    [new RecipeVariablesNotAvailableError('m'), 409, 'RECIPE_VARIABLES_NOT_AVAILABLE'],
  ])('%s → %i %s', (error, status, code) => {
    const exception = toHttpException(error);
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toMatchObject({ code });
  });

  it('INVALID_RECIPE_VALUES lleva el detalle por variable', () => {
    const issues = [{ signalVariableName: 'rEspiras', reason: 'MISSING' as const }];
    const exception = toHttpException(new InvalidRecipeValuesError(issues));
    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toMatchObject({
      code: 'INVALID_RECIPE_VALUES',
      details: issues,
    });
  });

  it('deja pasar una HttpException y oculta cualquier otro error como 500', () => {
    const http = new HttpException('x', 418);
    expect(toHttpException(http)).toBe(http);
    expect(toHttpException(new Error('boom')).getStatus()).toBe(500);
  });
});

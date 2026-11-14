import { describe, expect, it } from 'vitest';
import { MachineNotFoundError } from '../machine-management/errors/machine-not-found.error';
import { InvalidRecipeValuesError } from './errors/invalid-recipe-values.error';
import { RecipeIncompleteError } from './errors/recipe-incomplete.error';
import { RecipeLimitReachedError } from './errors/recipe-limit-reached.error';
import { RecipeModifiedError } from './errors/recipe-modified.error';
import { RecipeNotFoundError } from './errors/recipe-not-found.error';
import { RecipeTitleTakenError } from './errors/recipe-title-taken.error';
import { RecipeVariablesNotAvailableError } from './errors/recipe-variables-not-available.error';
import {
  ActivateRecipeUseCase,
  CreateRecipeUseCase,
  DeactivateRecipeUseCase,
  DeleteRecipeUseCase,
  GetRecipeUseCase,
  GetRecipeVariablesUseCase,
  ListRecipesUseCase,
  UpdateRecipeUseCase,
} from './recipes.use-cases';
import {
  FAKE_CTX,
  NOW,
  RECIPE,
  REQUESTER,
  VALUES,
  createRecipeFakes,
} from '../../../test/support/recipe-fakes';

const REF = { machineId: 'machine-1', requester: REQUESTER };

describe('GetRecipeVariablesUseCase (criterio backend 1)', () => {
  it('devuelve las variables de la categoría «Programación para la receta»', async () => {
    const fakes = createRecipeFakes();
    const useCase = new GetRecipeVariablesUseCase(fakes.access, fakes.unitOfWork);

    const result = await useCase.execute(REF);

    expect(result.category).toEqual({ id: 'recipe', name: 'Programación para la receta' });
    expect(result.variables.map((variable) => variable.signalVariableName)).toEqual([
      'rEspiras',
      'xSentidoCabezal',
    ]);
  });

  it('propaga MachineNotFoundError para una Machine de otra Company', async () => {
    const fakes = createRecipeFakes();
    fakes.machineAccessResolver.resolveActive.mockRejectedValue(new MachineNotFoundError('m'));
    const useCase = new GetRecipeVariablesUseCase(fakes.access, fakes.unitOfWork);

    await expect(useCase.execute(REF)).rejects.toBeInstanceOf(MachineNotFoundError);
  });
});

describe('ListRecipesUseCase (criterio backend 5)', () => {
  it('normaliza la búsqueda y marca si cada receta está completa', async () => {
    const fakes = createRecipeFakes();
    const useCase = new ListRecipesUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );

    const page = await useCase.execute({ ...REF, search: '  PROGRAMACIÓN ', limit: 20, offset: 0 });

    expect(fakes.recipeRepository.list).toHaveBeenCalledWith(
      'machine-1',
      { search: 'programacion', limit: 20, offset: 0 },
      FAKE_CTX,
    );
    expect(page).toEqual({
      data: [
        {
          id: 'recipe-1',
          title: 'Bobina 120',
          description: null,
          isActivated: false,
          activatedAt: null,
          updatedAt: NOW,
          updatedByEmail: 'demo@ewcontrol.local',
          isComplete: true,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('sin texto de búsqueda no filtra', async () => {
    const fakes = createRecipeFakes();
    const useCase = new ListRecipesUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({ ...REF, search: '   ', limit: 10, offset: 5 });

    expect(fakes.recipeRepository.list).toHaveBeenCalledWith(
      'machine-1',
      { limit: 10, offset: 5 },
      FAKE_CTX,
    );
  });
});

describe('GetRecipeUseCase', () => {
  it('devuelve la receta sin las claves internas y con su completitud', async () => {
    const fakes = createRecipeFakes();
    const useCase = new GetRecipeUseCase(fakes.access, fakes.unitOfWork);

    const view = await useCase.execute({ ...REF, recipeId: 'recipe-1' });

    expect(view).not.toHaveProperty('titleKey');
    expect(view).not.toHaveProperty('searchKey');
    expect(view).toMatchObject({
      id: 'recipe-1',
      isComplete: true,
      missingVariables: [],
      staleValues: [],
    });
  });

  it('una receta de otra Machine no existe', async () => {
    const fakes = createRecipeFakes({ recipe: { machineId: 'machine-2' } });
    const useCase = new GetRecipeUseCase(fakes.access, fakes.unitOfWork);

    await expect(useCase.execute({ ...REF, recipeId: 'recipe-1' })).rejects.toBeInstanceOf(
      RecipeNotFoundError,
    );
  });

  it('una receta inexistente da RecipeNotFoundError', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.findById.mockResolvedValue(null);
    const useCase = new GetRecipeUseCase(fakes.access, fakes.unitOfWork);

    await expect(useCase.execute({ ...REF, recipeId: 'x' })).rejects.toBeInstanceOf(
      RecipeNotFoundError,
    );
  });
});

describe('CreateRecipeUseCase (criterios backend 3 y 4)', () => {
  function createUseCase(fakes = createRecipeFakes()) {
    return {
      fakes,
      useCase: new CreateRecipeUseCase(
        fakes.access,
        fakes.recipeRepository as never,
        fakes.unitOfWork,
        fakes.clock,
      ),
    };
  }

  const INPUT = {
    ...REF,
    actorEmail: 'operador@ewcontrol.local',
    title: '  Bobina Á ',
    description: '  Cliente Norte ',
    // En otro orden: se guardan en el de la GVL.
    values: [...VALUES].reverse(),
  };

  it('guarda título y descripción recortados, claves normalizadas y valores en el orden de la GVL', async () => {
    const { fakes, useCase } = createUseCase();

    const view = await useCase.execute(INPUT);

    expect(fakes.recipeRepository.create).toHaveBeenCalledWith(
      {
        machineId: 'machine-1',
        title: 'Bobina Á',
        titleKey: 'bobina a',
        description: 'Cliente Norte',
        searchKey: 'bobina a\ncliente norte',
        values: VALUES,
        actorEmail: 'operador@ewcontrol.local',
        at: NOW,
      },
      FAKE_CTX,
    );
    expect(view.isComplete).toBe(true);
  });

  it('una descripción en blanco se guarda como null', async () => {
    const { fakes, useCase } = createUseCase();

    await useCase.execute({ ...INPUT, description: '   ' });

    expect(fakes.recipeRepository.create.mock.calls[0][0]).toMatchObject({ description: null });
  });

  it('exige todos los valores y devuelve todos los problemas', async () => {
    const { fakes, useCase } = createUseCase();

    const promise = useCase.execute({
      ...INPUT,
      values: [{ signalVariableName: 'rEspiras', value: -1 }],
    });

    await expect(promise).rejects.toBeInstanceOf(InvalidRecipeValuesError);
    await expect(promise).rejects.toMatchObject({
      issues: [
        { signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', min: 0, max: 10000 },
        { signalVariableName: 'xSentidoCabezal', reason: 'MISSING' },
      ],
    });
    expect(fakes.recipeRepository.create).not.toHaveBeenCalled();
  });

  it('sin la categoría de recetas no se puede crear', async () => {
    const { useCase } = createUseCase(createRecipeFakes({ categories: [] }));

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RecipeVariablesNotAvailableError);
  });

  it('rechaza un título ya usado aunque cambien mayúsculas o tildes', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.findByTitleKey.mockResolvedValue(RECIPE);
    const { useCase } = createUseCase(fakes);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RecipeTitleTakenError);
    expect(fakes.recipeRepository.findByTitleKey).toHaveBeenCalledWith(
      'machine-1',
      'bobina a',
      FAKE_CTX,
    );
  });

  it('no deja pasar de 500 recetas por Machine', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.countByMachine.mockResolvedValue(500);
    const { useCase } = createUseCase(fakes);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RecipeLimitReachedError);
  });
});

describe('UpdateRecipeUseCase (criterios backend 4 y 7)', () => {
  function createUseCase(fakes = createRecipeFakes()) {
    return {
      fakes,
      useCase: new UpdateRecipeUseCase(
        fakes.access,
        fakes.recipeRepository as never,
        fakes.unitOfWork,
        fakes.clock,
      ),
    };
  }

  const INPUT = {
    ...REF,
    recipeId: 'recipe-1',
    actorEmail: 'demo@ewcontrol.local',
    title: 'Bobina 120',
    values: VALUES,
    version: 3,
  };

  it('sustituye el contenido pasando la versión leída', async () => {
    const { fakes, useCase } = createUseCase();

    const view = await useCase.execute({ ...INPUT, title: 'Bobina 130' });

    expect(fakes.recipeRepository.update).toHaveBeenCalledWith(
      'recipe-1',
      3,
      expect.objectContaining({ title: 'Bobina 130', titleKey: 'bobina 130', at: NOW }),
      FAKE_CTX,
    );
    expect(view.version).toBe(4);
  });

  it('una versión antigua da RecipeModifiedError sin guardar', async () => {
    const { fakes, useCase } = createUseCase();

    await expect(useCase.execute({ ...INPUT, version: 2 })).rejects.toBeInstanceOf(
      RecipeModifiedError,
    );
    expect(fakes.recipeRepository.update).not.toHaveBeenCalled();
  });

  it('si otra edición gana la carrera en BD, también da RecipeModifiedError', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.update.mockResolvedValue(null as never);
    const { useCase } = createUseCase(fakes);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RecipeModifiedError);
  });

  it('mantener el propio título no choca consigo misma', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.findByTitleKey.mockResolvedValue(RECIPE);
    const { useCase } = createUseCase(fakes);

    await expect(useCase.execute(INPUT)).resolves.toMatchObject({ id: 'recipe-1' });
  });

  it('el título de otra receta da RecipeTitleTakenError', async () => {
    const fakes = createRecipeFakes();
    fakes.recipeRepository.findByTitleKey.mockResolvedValue({ ...RECIPE, id: 'recipe-2' });
    const { useCase } = createUseCase(fakes);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(RecipeTitleTakenError);
  });
});

describe('DeleteRecipeUseCase', () => {
  it('borra la receta de la Machine', async () => {
    const fakes = createRecipeFakes();
    const useCase = new DeleteRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({ ...REF, recipeId: 'recipe-1' });

    expect(fakes.recipeRepository.delete).toHaveBeenCalledWith('recipe-1', FAKE_CTX);
  });
});

describe('ActivateRecipeUseCase (criterio backend 6)', () => {
  function createUseCase(fakes = createRecipeFakes()) {
    return {
      fakes,
      useCase: new ActivateRecipeUseCase(
        fakes.access,
        fakes.recipeRepository as never,
        fakes.unitOfWork,
        fakes.clock,
      ),
    };
  }

  it('activa una receta completa con quién y cuándo', async () => {
    const { fakes, useCase } = createUseCase();

    const view = await useCase.execute({ ...REF, recipeId: 'recipe-1', actorEmail: 'op@x' });

    expect(fakes.recipeRepository.activate).toHaveBeenCalledWith(
      'machine-1',
      'recipe-1',
      { actorEmail: 'op@x', at: NOW },
      FAKE_CTX,
    );
    expect(view.isActivated).toBe(true);
  });

  it('una receta incompleta no se puede activar', async () => {
    const { fakes, useCase } = createUseCase(
      createRecipeFakes({ recipe: { values: VALUES.slice(0, 1) } }),
    );

    await expect(
      useCase.execute({ ...REF, recipeId: 'recipe-1', actorEmail: 'op@x' }),
    ).rejects.toBeInstanceOf(RecipeIncompleteError);
    expect(fakes.recipeRepository.activate).not.toHaveBeenCalled();
  });

  it('activar la que ya está activa no cambia nada', async () => {
    const { fakes, useCase } = createUseCase(createRecipeFakes({ recipe: { isActivated: true } }));

    const view = await useCase.execute({ ...REF, recipeId: 'recipe-1', actorEmail: 'op@x' });

    expect(view.isActivated).toBe(true);
    expect(fakes.recipeRepository.activate).not.toHaveBeenCalled();
  });
});

describe('DeactivateRecipeUseCase', () => {
  it('desmarca la receta activa', async () => {
    const fakes = createRecipeFakes({ recipe: { isActivated: true } });
    const useCase = new DeactivateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );

    const view = await useCase.execute({ ...REF, recipeId: 'recipe-1' });

    expect(fakes.recipeRepository.deactivate).toHaveBeenCalledWith('recipe-1', FAKE_CTX);
    expect(view.isActivated).toBe(false);
  });

  it('desactivar una receta que no está activa no cambia nada', async () => {
    const fakes = createRecipeFakes();
    const useCase = new DeactivateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({ ...REF, recipeId: 'recipe-1' });

    expect(fakes.recipeRepository.deactivate).not.toHaveBeenCalled();
  });
});

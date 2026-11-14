import { describe, expect, it } from 'vitest';
import {
  createRecipeFakes,
  FAKE_CTX,
  NOW,
  REQUESTER,
  TEMPLATE,
  templateConfig,
} from '../../../test/support/recipe-fakes';
import type { RecipeTemplateContent } from '../../entities/recipe-template.vo';
import { MachineNotFoundError } from '../machine-management/errors/machine-not-found.error';
import { InvalidRecipeTemplateError } from './errors/invalid-recipe-template.error';
import { RecipeIncompleteError } from './errors/recipe-incomplete.error';
import { RecipeTemplateInvalidError } from './errors/recipe-template-invalid.error';
import { RecipeTemplateModifiedError } from './errors/recipe-template-modified.error';
import { RecipeVariablesNotAvailableError } from './errors/recipe-variables-not-available.error';
import {
  GetRecipeTemplateUseCase,
  PreviewRecipeTemplateImpactUseCase,
  SaveRecipeTemplateUseCase,
} from './recipe-template.use-cases';
import {
  ActivateRecipeUseCase,
  CreateRecipeUseCase,
  GetRecipeUseCase,
  GetRecipeVariablesUseCase,
  ListRecipesUseCase,
} from './recipes.use-cases';

const REF = { machineId: 'machine-1', requester: REQUESTER };

/** `rEspiras` editable con máximo 400 y `xSentidoCabezal` oculta. */
const CONTENT: RecipeTemplateContent = {
  variables: [
    templateConfig('rEspiras', 'EDITABLE', { max: 400 }),
    templateConfig('xSentidoCabezal', 'HIDDEN'),
  ],
  layout: {
    rows: [{ items: [{ type: 'VARIABLE', span: 12, signalVariableName: 'rEspiras' }] }],
  },
};

describe('GetRecipeTemplateUseCase (spec 26, criterio backend 1)', () => {
  it('sin receta base guardada devuelve la por defecto, con sugerencias del comentario', async () => {
    const fakes = createRecipeFakes();
    const useCase = new GetRecipeTemplateUseCase(fakes.access, fakes.unitOfWork);

    const view = await useCase.execute(REF);

    expect(view).toMatchObject({
      isDefault: true,
      version: 0,
      updatedAt: null,
      updatedByEmail: null,
      removedVariables: [],
      staleConfig: [],
      excludedCount: 0,
    });
    expect(view.variables).toEqual([
      expect.objectContaining({
        signalVariableName: 'rEspiras',
        dataType: 'Float',
        mappingMin: 0,
        mappingMax: 10000,
        isUnconfigured: false,
        suggestedOptions: null,
        suggestedBooleanLabels: null,
        config: expect.objectContaining({ mode: 'EDITABLE', label: null }),
      }),
      expect.objectContaining({
        signalVariableName: 'xSentidoCabezal',
        suggestedBooleanLabels: { falseLabel: 'Horario', trueLabel: 'Antihorario' },
      }),
    ]);
    expect(view.variables[0].config).not.toHaveProperty('signalVariableName');
    expect(view.layout.rows).toHaveLength(1);
  });

  it('con receta base guardada devuelve su versión, autor y configuración', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE });
    const useCase = new GetRecipeTemplateUseCase(fakes.access, fakes.unitOfWork);

    const view = await useCase.execute(REF);

    expect(view).toMatchObject({
      isDefault: false,
      version: 2,
      updatedAt: NOW,
      updatedByEmail: 'demo@ewcontrol.local',
    });
    expect(view.variables[1].config).toMatchObject({ mode: 'FIXED_HIDDEN', fixedValue: true });
  });

  it('propaga MachineNotFoundError', async () => {
    const fakes = createRecipeFakes();
    fakes.machineAccessResolver.resolveActive.mockRejectedValue(new MachineNotFoundError('x'));
    const useCase = new GetRecipeTemplateUseCase(fakes.access, fakes.unitOfWork);

    await expect(useCase.execute(REF)).rejects.toBeInstanceOf(MachineNotFoundError);
  });
});

describe('SaveRecipeTemplateUseCase (spec 26, criterios backend 2 y 3)', () => {
  function createUseCase(fakes = createRecipeFakes()) {
    return {
      fakes,
      useCase: new SaveRecipeTemplateUseCase(
        fakes.access,
        fakes.recipeTemplateRepository as never,
        fakes.unitOfWork,
        fakes.clock,
      ),
    };
  }

  it('crea la receta base partiendo de la por defecto (versión 0)', async () => {
    const { fakes, useCase } = createUseCase();

    const view = await useCase.execute({
      ...REF,
      content: CONTENT,
      version: 0,
      actorEmail: 'admin@x',
    });

    expect(fakes.recipeTemplateRepository.save).toHaveBeenCalledWith(
      'machine-1',
      0,
      CONTENT,
      { actorEmail: 'admin@x', at: NOW },
      FAKE_CTX,
    );
    expect(view).toMatchObject({ isDefault: false, version: 1 });
    expect(view.variables[1].config.mode).toBe('HIDDEN');
  });

  it('una versión que ya no es la vigente da RecipeTemplateModifiedError sin guardar', async () => {
    const { fakes, useCase } = createUseCase(createRecipeFakes({ template: TEMPLATE }));

    await expect(
      useCase.execute({ ...REF, content: CONTENT, version: 1, actorEmail: 'admin@x' }),
    ).rejects.toBeInstanceOf(RecipeTemplateModifiedError);
    expect(fakes.recipeTemplateRepository.save).not.toHaveBeenCalled();
  });

  it('si otro guardado gana la carrera en BD, también da RecipeTemplateModifiedError', async () => {
    const { fakes, useCase } = createUseCase(createRecipeFakes({ template: TEMPLATE }));
    fakes.recipeTemplateRepository.save.mockResolvedValue(null);

    await expect(
      useCase.execute({ ...REF, content: CONTENT, version: 2, actorEmail: 'admin@x' }),
    ).rejects.toBeInstanceOf(RecipeTemplateModifiedError);
  });

  it('una receta base no válida da InvalidRecipeTemplateError con todos los problemas', async () => {
    const { fakes, useCase } = createUseCase();
    const content: RecipeTemplateContent = {
      variables: [templateConfig('rEspiras', 'FIXED_VISIBLE')],
      layout: { rows: [] },
    };

    const error = await useCase
      .execute({ ...REF, content, version: 0, actorEmail: 'admin@x' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(InvalidRecipeTemplateError);
    expect((error as InvalidRecipeTemplateError).issues).toEqual([
      { signalVariableName: 'rEspiras', field: 'fixedValue', reason: 'FIXED_VALUE_REQUIRED' },
      { signalVariableName: 'xSentidoCabezal', reason: 'MISSING' },
      { signalVariableName: 'rEspiras', reason: 'VARIABLE_NOT_PLACED' },
    ]);
    expect(fakes.recipeTemplateRepository.save).not.toHaveBeenCalled();
  });

  it('sin variables de receta no se puede guardar', async () => {
    const { useCase } = createUseCase(createRecipeFakes({ categories: [] }));

    await expect(
      useCase.execute({ ...REF, content: CONTENT, version: 0, actorEmail: 'admin@x' }),
    ).rejects.toBeInstanceOf(RecipeVariablesNotAvailableError);
  });
});

describe('PreviewRecipeTemplateImpactUseCase (spec 26, criterio backend 4)', () => {
  function createUseCase(fakes = createRecipeFakes()) {
    return new PreviewRecipeTemplateImpactUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    );
  }

  it('cuenta las recetas completas que pasarían a incompletas, sin guardar nada', async () => {
    const fakes = createRecipeFakes({
      recipe: {
        isActivated: true,
        values: [
          { signalVariableName: 'rEspiras', value: 450 },
          { signalVariableName: 'xSentidoCabezal', value: false },
        ],
      },
    });

    const impact = await createUseCase(fakes).execute({ ...REF, content: CONTENT });

    expect(impact).toEqual({
      recipesBecomingIncomplete: 1,
      activeRecipeBecomingIncomplete: { id: 'recipe-1', title: 'Bobina 120' },
      examples: ['Bobina 120'],
    });
    expect(fakes.recipeTemplateRepository.save).not.toHaveBeenCalled();
  });

  it('valida la receta base propuesta igual que al guardar', async () => {
    await expect(
      createUseCase().execute({ ...REF, content: { ...CONTENT, layout: { rows: [] } } }),
    ).rejects.toBeInstanceOf(InvalidRecipeTemplateError);
  });
});

describe('Recetas con receta base (spec 26)', () => {
  it('el formulario solo trae las variables visibles con sus reglas efectivas', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE });
    const form = await new GetRecipeVariablesUseCase(fakes.access, fakes.unitOfWork).execute(REF);

    expect(form.variables).toEqual([
      expect.objectContaining({ signalVariableName: 'rEspiras', label: 'Espiras', max: 500 }),
    ]);
    expect(form).toMatchObject({ hiddenCount: 1, isTemplateValid: true });
    expect(JSON.stringify(form)).not.toContain('"fixedValue":true');
  });

  it('solo admite valores de las editables y con sus reglas', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE });
    const useCase = new CreateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
      fakes.clock,
    );

    const error = await useCase
      .execute({
        ...REF,
        actorEmail: 'op@x',
        title: 'Nueva',
        values: [
          { signalVariableName: 'rEspiras', value: 600 },
          { signalVariableName: 'xSentidoCabezal', value: true },
        ],
      })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      issues: [
        { signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', min: 0, max: 500 },
        { signalVariableName: 'xSentidoCabezal', reason: 'NOT_EDITABLE' },
      ],
    });
  });

  it('guarda solo los valores editables', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE });
    const useCase = new CreateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
      fakes.clock,
    );

    const view = await useCase.execute({
      ...REF,
      actorEmail: 'op@x',
      title: 'Nueva',
      values: [{ signalVariableName: 'rEspiras', value: 300 }],
    });

    expect(fakes.recipeRepository.create.mock.calls[0][0]).toMatchObject({
      values: [{ signalVariableName: 'rEspiras', value: 300 }],
    });
    expect(view.effectiveValues).toEqual([
      { signalVariableName: 'rEspiras', value: 300, source: 'RECIPE' },
      { signalVariableName: 'xSentidoCabezal', value: true, source: 'FIXED' },
    ]);
  });

  it('un valor de una variable que pasó a fija se ignora sin dejar la receta incompleta', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE });
    const view = await new GetRecipeUseCase(fakes.access, fakes.unitOfWork).execute({
      ...REF,
      recipeId: 'recipe-1',
    });

    expect(view).toMatchObject({
      isComplete: true,
      ignoredValues: [{ signalVariableName: 'xSentidoCabezal', value: false }],
    });
    const page = await new ListRecipesUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
    ).execute({ ...REF, limit: 20, offset: 0 });
    expect(page.data[0].isComplete).toBe(true);
  });

  it('una receta incompleta no devuelve lo que llegaría a la máquina', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE, recipe: { values: [] } });
    const view = await new GetRecipeUseCase(fakes.access, fakes.unitOfWork).execute({
      ...REF,
      recipeId: 'recipe-1',
    });

    expect(view).toMatchObject({ isComplete: false, effectiveValues: null });
  });

  it('con un valor fijo que ya no vale no se puede activar', async () => {
    const invalid = {
      ...TEMPLATE,
      variables: [
        TEMPLATE.variables[0],
        templateConfig('xSentidoCabezal', 'FIXED_HIDDEN', { fixedValue: 3 }),
      ],
    };
    const fakes = createRecipeFakes({ template: invalid });
    const useCase = new ActivateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
      fakes.clock,
    );

    await expect(
      useCase.execute({ ...REF, recipeId: 'recipe-1', actorEmail: 'op@x' }),
    ).rejects.toBeInstanceOf(RecipeTemplateInvalidError);
    expect(fakes.recipeRepository.activate).not.toHaveBeenCalled();
  });

  it('la receta incompleta se rechaza antes que la receta base no válida', async () => {
    const fakes = createRecipeFakes({ template: TEMPLATE, recipe: { values: [] } });
    const useCase = new ActivateRecipeUseCase(
      fakes.access,
      fakes.recipeRepository as never,
      fakes.unitOfWork,
      fakes.clock,
    );

    await expect(
      useCase.execute({ ...REF, recipeId: 'recipe-1', actorEmail: 'op@x' }),
    ).rejects.toBeInstanceOf(RecipeIncompleteError);
  });
});

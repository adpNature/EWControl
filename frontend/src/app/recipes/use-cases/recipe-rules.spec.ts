import { RecipeVariable } from '../entities/recipe.model';
import {
  copyTitle,
  initialValue,
  issueMessage,
  parseRecipeInput,
  recipeErrorMessage,
  recipeStatusLabel,
  recipeValueError,
  staleValueMessage,
} from './recipe-rules';
import { unsavedRecipeChangesGuard } from './unsaved-recipe-changes.guard';

function variable(dataType: string, limits: { min?: number; max?: number } = {}): RecipeVariable {
  return {
    signalVariableName: 'v',
    dataType,
    comment: null,
    min: limits.min ?? null,
    max: limits.max ?? null,
  };
}

describe('recipe-rules (docs/specs/25-recetas.md)', () => {
  it('valor inicial: No en los interruptores, texto vacío en String y sin valor en los numéricos', () => {
    expect(initialValue(variable('Boolean'))).toBe(false);
    expect(initialValue(variable('String'))).toBe('');
    expect(initialValue(variable('Float'))).toBeNull();
  });

  it('todos los valores son obligatorios', () => {
    expect(recipeValueError(variable('Float'), null)).toBe('Obligatorio.');
    expect(recipeValueError(variable('Float'), Number.NaN)).toBe('Obligatorio.');
    expect(recipeValueError(variable('String'), '')).toBeNull();
    expect(recipeValueError(variable('Boolean'), false)).toBeNull();
  });

  it('valida tipo y límites como los paquetes de escritura', () => {
    expect(recipeValueError(variable('Int16'), 2.5)).toBe('Entero entre -32768 y 32767.');
    expect(recipeValueError(variable('Float', { min: 0, max: 10 }), 11)).toBe('Máximo 10.');
    expect(recipeValueError(variable('Float', { min: 0, max: 10 }), -1)).toBe('Mínimo 0.');
    expect(recipeValueError(variable('Float', { min: 0, max: 10 }), 5)).toBeNull();
  });

  it('convierte lo escrito al tipo de la variable', () => {
    expect(parseRecipeInput(variable('Float'), '0,5')).toBe(0.5);
    expect(parseRecipeInput(variable('Float'), '')).toBeNull();
    expect(parseRecipeInput(variable('String'), 'abc')).toBe('abc');
    expect(parseRecipeInput(variable('Boolean'), true)).toBe(true);
  });

  it('el título de una copia no pasa de 120 caracteres', () => {
    expect(copyTitle('Bobina')).toBe('Bobina (copia)');
    expect(copyTitle('x'.repeat(120))).toHaveLength(120);
  });

  it('etiqueta de estado del listado', () => {
    expect(recipeStatusLabel({ isActivated: true, isComplete: true })).toBe('Activa');
    expect(recipeStatusLabel({ isActivated: true, isComplete: false })).toBe('Activa · Incompleta');
    expect(recipeStatusLabel({ isActivated: false, isComplete: false })).toBe('Incompleta');
    expect(recipeStatusLabel({ isActivated: false, isComplete: true })).toBe('—');
  });

  it('mensajes de los problemas devueltos por el Backend', () => {
    expect(issueMessage({ signalVariableName: 'v', reason: 'MISSING' })).toBe('Obligatorio.');
    expect(issueMessage({ signalVariableName: 'v', reason: 'OUT_OF_RANGE', min: 0, max: 5 })).toBe(
      'Fuera de los límites (mínimo 0, máximo 5).',
    );
    expect(issueMessage({ signalVariableName: 'v', reason: 'OUT_OF_RANGE' })).toBe(
      'Fuera de los límites permitidos.',
    );
    expect(issueMessage({ signalVariableName: 'v', reason: 'TYPE_MISMATCH' })).toContain('tipo');
  });

  it('mensajes de valores que ya no se pueden usar', () => {
    expect(
      staleValueMessage({ signalVariableName: 'rX', value: 3, reason: 'NOT_A_RECIPE_VARIABLE' }),
    ).toBe('rX: ya no es una variable de la receta.');
    expect(staleValueMessage({ signalVariableName: 'rX', value: 3, reason: 'OUT_OF_RANGE' })).toBe(
      'rX: el valor guardado (3) ya no es válido.',
    );
  });

  it('traduce los códigos de error de la API', () => {
    expect(recipeErrorMessage({ status: 409, code: 'RECIPE_TITLE_TAKEN', message: '' })).toBe(
      'Ya existe una receta con ese título en esta máquina.',
    );
    expect(recipeErrorMessage({ status: 500, code: 'X', message: '' })).toBe(
      'No se ha podido completar la operación.',
    );
  });
});

describe('unsavedRecipeChangesGuard', () => {
  const run = (hasChanges: boolean) =>
    unsavedRecipeChangesGuard(
      { hasUnsavedChanges: () => hasChanges },
      undefined as never,
      undefined as never,
      undefined as never,
    );

  it('deja salir sin preguntar si no hay cambios', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    expect(run(false)).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('con cambios pide confirmación', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(run(true)).toBe(false);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipesApiService } from '../../adapters/recipes-api.service';
import { Recipe, RecipeVariableSet } from '../../entities/recipe.model';
import { RecipeFormPage } from './recipe-form-page';

const VARIABLES: RecipeVariableSet = {
  category: { id: 'cat', name: 'Programación para la receta' },
  variables: [
    { signalVariableName: 'rEspiras', dataType: 'Float', comment: null, min: 0, max: 10000 },
    {
      signalVariableName: 'xSentidoCabezal',
      dataType: 'Boolean',
      comment: '2 opciones: 0 - Horario / 1 - Antihorario',
      min: null,
      max: null,
    },
    { signalVariableName: 'sNombre', dataType: 'String', comment: null, min: null, max: null },
  ],
  excludedCount: 0,
};

const RECIPE: Recipe = {
  id: 'recipe-1',
  machineId: 'machine-1',
  title: 'Bobina 120',
  description: 'Cliente Norte',
  values: [
    { signalVariableName: 'rEspiras', value: 350 },
    { signalVariableName: 'xSentidoCabezal', value: true },
    { signalVariableName: 'sNombre', value: 'B120' },
  ],
  missingVariables: [],
  staleValues: [],
  isComplete: true,
  isActivated: false,
  activatedAt: null,
  activatedByEmail: null,
  version: 3,
  createdAt: '2026-11-13T10:00:00Z',
  createdByEmail: 'demo@ewcontrol.local',
  updatedAt: '2026-11-13T10:00:00Z',
  updatedByEmail: 'demo@ewcontrol.local',
};

describe('RecipeFormPage (docs/specs/25-recetas.md)', () => {
  let recipesApi: Record<string, ReturnType<typeof vi.fn>>;
  let toasts: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    recipesApi = {
      variables: vi.fn().mockReturnValue(of(VARIABLES)),
      get: vi.fn().mockReturnValue(of(RECIPE)),
      create: vi.fn().mockReturnValue(of(RECIPE)),
      update: vi.fn().mockReturnValue(of(RECIPE)),
    };
    toasts = { show: vi.fn() };
  });

  async function renderPage(params: { recipeId?: string; duplicar?: string } = {}) {
    const result = await render(RecipeFormPage, {
      providers: [
        provideRouter([]),
        { provide: RecipesApiService, useValue: recipesApi },
        { provide: ToastService, useValue: toasts },
        { provide: LocalStorageService, useValue: { getItem: vi.fn(), setItem: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                machineId: 'machine-1',
                ...(params.recipeId ? { recipeId: params.recipeId } : {}),
              }),
              queryParamMap: convertToParamMap(
                params.duplicar ? { duplicar: params.duplicar } : {},
              ),
            },
          },
        },
      ],
    });
    const router = result.fixture.debugElement.injector.get(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return { ...result, navigate };
  }

  it('muestra todas las variables con su control y su ayuda (criterio 3)', async () => {
    await renderPage();

    expect(await screen.findByRole('spinbutton', { name: 'rEspiras' })).toHaveValue(null);
    expect(screen.getByRole('switch', { name: /xSentidoCabezal/ })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'sNombre' })).toHaveValue('');
    expect(screen.getByText('2 opciones: 0 - Horario / 1 - Antihorario')).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 variables con valor/)).toBeInTheDocument();
  });

  it('no deja guardar con campos vacíos y lleva el foco al primero con error (criterio 4)', async () => {
    await renderPage();
    await screen.findByRole('spinbutton', { name: 'rEspiras' });

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(recipesApi['create']).not.toHaveBeenCalled();
    expect(screen.getByText('El título es obligatorio.')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'rEspiras' })).toHaveAccessibleDescription(
      /Obligatorio\./,
    );
    await vi.waitFor(() => expect(screen.getByLabelText('Título')).toHaveFocus());
  });

  it('crea la receta con todos los valores en el orden de la GVL', async () => {
    const { navigate } = await renderPage();

    await userEvent.type(await screen.findByLabelText('Título'), 'Nueva');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'rEspiras' }), '350');
    await userEvent.click(screen.getByRole('switch', { name: /xSentidoCabezal/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(recipesApi['create']).toHaveBeenCalledWith('machine-1', {
      title: 'Nueva',
      description: null,
      values: [
        { signalVariableName: 'rEspiras', value: 350 },
        { signalVariableName: 'xSentidoCabezal', value: true },
        { signalVariableName: 'sNombre', value: '' },
      ],
    });
    expect(toasts.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Receta "Bobina 120" guardada.',
    });
    expect(navigate).toHaveBeenCalledWith(['/recetas']);
  });

  it('valida los límites en el cliente', async () => {
    await renderPage();

    await userEvent.type(await screen.findByLabelText('Título'), 'X');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'rEspiras' }), '20000');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Máximo 10000.')).toBeInTheDocument();
    expect(recipesApi['create']).not.toHaveBeenCalled();
  });

  it('el filtro reduce la lista de variables', async () => {
    await renderPage();

    await userEvent.type(await screen.findByLabelText('Filtrar variables'), 'horario');

    expect(screen.queryByRole('spinbutton', { name: 'rEspiras' })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /xSentidoCabezal/ })).toBeInTheDocument();
  });

  it('duplicar abre una receta nueva con los valores y el título «(copia)» (criterio 5)', async () => {
    await renderPage({ duplicar: 'recipe-1' });

    expect(await screen.findByLabelText('Título')).toHaveValue('Bobina 120 (copia)');
    expect(screen.getByRole('spinbutton', { name: 'rEspiras' })).toHaveValue(350);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(recipesApi['create']).toHaveBeenCalledWith(
      'machine-1',
      expect.objectContaining({ title: 'Bobina 120 (copia)', description: 'Cliente Norte' }),
    );
  });

  it('edita enviando la versión leída', async () => {
    await renderPage({ recipeId: 'recipe-1' });

    expect(await screen.findByRole('heading', { name: 'Editar receta' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(recipesApi['update']).toHaveBeenCalledWith(
      'machine-1',
      'recipe-1',
      expect.objectContaining({ title: 'Bobina 120', version: 3 }),
    );
  });

  it('un título repetido se marca en el campo (criterio 8)', async () => {
    recipesApi['update'].mockReturnValue(
      throwError(() => ({ status: 409, code: 'RECIPE_TITLE_TAKEN', message: '' })),
    );
    await renderPage({ recipeId: 'recipe-1' });

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));

    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription(
      'Ya existe una receta con ese título en esta máquina.',
    );
  });

  it('una edición simultánea ofrece recargar o seguir editando (criterio 8)', async () => {
    recipesApi['update'].mockReturnValue(
      throwError(() => ({ status: 409, code: 'RECIPE_MODIFIED', message: '' })),
    );
    await renderPage({ recipeId: 'recipe-1' });
    await userEvent.clear(await screen.findByLabelText('Título'));
    await userEvent.type(screen.getByLabelText('Título'), 'Mío');

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('La receta ha cambiado');
    await userEvent.click(screen.getByRole('button', { name: 'Recargar la receta' }));

    expect(recipesApi['get']).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Título')).toHaveValue('Bobina 120');
  });

  it('seguir editando conserva lo escrito', async () => {
    recipesApi['update'].mockReturnValue(
      throwError(() => ({ status: 409, code: 'RECIPE_MODIFIED', message: '' })),
    );
    await renderPage({ recipeId: 'recipe-1' });
    await userEvent.clear(await screen.findByLabelText('Título'));
    await userEvent.type(screen.getByLabelText('Título'), 'Mío');

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Título')).toHaveValue('Mío');
  });

  it('marca las filas que rechaza el Backend hasta que se cambian', async () => {
    recipesApi['update'].mockReturnValue(
      throwError(() => ({
        status: 400,
        code: 'INVALID_RECIPE_VALUES',
        message: '',
        details: [{ signalVariableName: 'rEspiras', reason: 'OUT_OF_RANGE', max: 100 }],
      })),
    );
    await renderPage({ recipeId: 'recipe-1' });

    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));

    const input = screen.getByRole('spinbutton', { name: 'rEspiras' });
    expect(input).toHaveAccessibleDescription(/Fuera de los límites \(máximo 100\)\./);
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los valores marcados.');
  });

  it('avisa de las variables que faltan y de los valores que se quitarán', async () => {
    recipesApi['get'].mockReturnValue(
      of({
        ...RECIPE,
        isComplete: false,
        values: RECIPE.values.slice(1),
        missingVariables: ['rEspiras'],
        staleValues: [
          { signalVariableName: 'rBorrada', value: 1, reason: 'NOT_A_RECIPE_VARIABLE' },
        ],
      }),
    );
    await renderPage({ recipeId: 'recipe-1' });

    expect(await screen.findByText('Variables sin valor: rEspiras.')).toBeInTheDocument();
    expect(screen.getByText('rBorrada: ya no es una variable de la receta.')).toBeInTheDocument();
  });

  it('sabe si hay cambios sin guardar', async () => {
    const { fixture } = await renderPage({ recipeId: 'recipe-1' });
    await screen.findByLabelText('Título');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);

    await userEvent.type(screen.getByLabelText('Título'), '!');

    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('sin la categoría no muestra el formulario', async () => {
    recipesApi['variables'].mockReturnValue(
      of({ category: null, variables: [], excludedCount: 0 }),
    );
    await renderPage();

    expect(await screen.findByText(/no tiene la categoría/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('un error al cargar se muestra', async () => {
    recipesApi['get'].mockReturnValue(
      throwError(() => ({ status: 404, code: 'RECIPE_NOT_FOUND', message: '' })),
    );
    await renderPage({ recipeId: 'x' });

    expect(await screen.findByRole('alert')).toHaveTextContent('La receta ya no existe.');
  });
});

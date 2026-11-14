import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipesApiService } from '../../adapters/recipes-api.service';
import { RecipeSummary, RecipeVariableSet } from '../../entities/recipe.model';
import { RecipesPage, SEARCH_DEBOUNCE_MS, SELECTED_MACHINE_KEY } from './recipes-page';

const MACHINES = [
  { id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1', providerType: 'OpcUa' },
  { id: 'machine-2', companyId: 'company-1', name: 'Bobinadora 2', providerType: 'OpcUa' },
];

const VARIABLES: RecipeVariableSet = {
  category: { id: 'cat', name: 'Programación para la receta' },
  variables: [
    { signalVariableName: 'rEspiras', dataType: 'Float', comment: null, min: null, max: null },
  ],
  excludedCount: 0,
};

function summary(overrides: Partial<RecipeSummary> = {}): RecipeSummary {
  return {
    id: 'recipe-1',
    title: 'Bobina 120',
    description: 'Cliente Norte',
    isActivated: false,
    activatedAt: null,
    isComplete: true,
    updatedAt: '2026-11-13T10:00:00Z',
    updatedByEmail: 'operador@ewcontrol.local',
    ...overrides,
  };
}

const ACTIVE = summary({ id: 'recipe-0', title: 'Bobina activa', isActivated: true });

describe('RecipesPage (docs/specs/25-recetas.md)', () => {
  let recipesApi: Record<string, ReturnType<typeof vi.fn>>;
  let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  let toasts: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    recipesApi = {
      variables: vi.fn().mockReturnValue(of(VARIABLES)),
      list: vi.fn((...[, params]: [string, { limit: number }]) =>
        of(
          params.limit === 1
            ? { data: [ACTIVE], total: 2, limit: 1, offset: 0 }
            : { data: [ACTIVE, summary()], total: 2, limit: 20, offset: 0 },
        ),
      ),
      activate: vi.fn().mockReturnValue(of({})),
      deactivate: vi.fn().mockReturnValue(of({})),
      remove: vi.fn().mockReturnValue(of(undefined)),
    };
    storage = { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() };
    toasts = { show: vi.fn() };
  });

  async function renderPage(role: 'Operador' | 'AdminCliente' = 'Operador') {
    return render(RecipesPage, {
      providers: [
        provideRouter([]),
        {
          provide: MachinesApiService,
          useValue: { list: vi.fn().mockReturnValue(of({ data: MACHINES, total: 2 })) },
        },
        { provide: RecipesApiService, useValue: recipesApi },
        { provide: LocalStorageService, useValue: storage },
        { provide: ToastService, useValue: toasts },
        {
          provide: AuthStateService,
          useValue: { currentUser: signal({ id: 'u', email: 'u@x', companyId: 'c', role }) },
        },
      ],
    });
  }

  it('lista las recetas de la primera Machine, con la activa marcada (criterio 1)', async () => {
    await renderPage();

    const rows = await screen.findAllByRole('row');
    expect(within(rows[1]).getByText('Bobina activa')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Activa')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Bobina 120')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nueva receta' })).toHaveAttribute(
      'href',
      '/recetas/machine-1/nueva',
    );
    expect(storage.setItem).toHaveBeenCalledWith(SELECTED_MACHINE_KEY, 'machine-1');
  });

  it('recuerda la última Machine elegida', async () => {
    storage.getItem.mockReturnValue('machine-2');

    await renderPage();

    expect(recipesApi['variables']).toHaveBeenCalledWith('machine-2');
  });

  it('marca las incompletas y no deja activarlas (criterio 6)', async () => {
    recipesApi['list'].mockReturnValue(
      of({ data: [summary({ isComplete: false })], total: 1, limit: 20, offset: 0 }),
    );
    await renderPage();

    expect(await screen.findByText('Incompleta')).toBeInTheDocument();
    const activate = screen.getByRole('button', { name: 'Activar Bobina 120' });
    expect(activate).toBeDisabled();
    expect(activate).toHaveAccessibleDescription('Complétala antes de activarla');
  });

  it('busca tras dejar de escribir y vuelve a la primera página (criterio 2)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    recipesApi['list'].mockClear();

    await user.type(await screen.findByLabelText('Buscar por título o descripción'), 'bobína');
    expect(recipesApi['list']).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(recipesApi['list']).toHaveBeenCalledWith('machine-1', {
      search: 'bobína',
      limit: 20,
      offset: 0,
    });
    vi.useRealTimers();
  });

  it('sin resultados lo dice con el texto buscado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await renderPage();
    recipesApi['list'].mockReturnValue(of({ data: [], total: 0, limit: 20, offset: 0 }));

    await user.type(await screen.findByLabelText('Buscar por título o descripción'), 'zzz');
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);

    expect(await screen.findByText('Sin resultados para "zzz"')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('activar con otra activa pide confirmación y avisa de que no se envía nada (criterio 7)', async () => {
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Activar Bobina 120' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('La receta "Bobina activa" dejará de estar activa.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));

    expect(recipesApi['activate']).toHaveBeenCalledWith('machine-1', 'recipe-1');
    expect(toasts.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Receta marcada como activa. Por ahora no se envía nada a la máquina.',
    });
  });

  it('activar sin otra activa no pregunta', async () => {
    recipesApi['list'].mockReturnValue(of({ data: [summary()], total: 1, limit: 20, offset: 0 }));
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Activar Bobina 120' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(recipesApi['activate']).toHaveBeenCalled();
  });

  it('desactivar quita la marca', async () => {
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar Bobina activa' }));

    expect(recipesApi['deactivate']).toHaveBeenCalledWith('machine-1', 'recipe-0');
  });

  it('borrar la activa pide confirmación y avisa (criterio 8)', async () => {
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Bobina activa' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('la máquina se quedará sin receta activa');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Eliminar' }));

    expect(recipesApi['remove']).toHaveBeenCalledWith('machine-1', 'recipe-0');
  });

  it('cancelar el diálogo no hace nada', async () => {
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Bobina 120' }));
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('sin receta activa');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(recipesApi['remove']).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('un error al activar se muestra como toast', async () => {
    recipesApi['list'].mockReturnValue(of({ data: [summary()], total: 1, limit: 20, offset: 0 }));
    recipesApi['activate'].mockReturnValue(
      throwError(() => ({ status: 409, code: 'RECIPE_INCOMPLETE', message: '' })),
    );
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Activar Bobina 120' }));

    expect(toasts.show).toHaveBeenCalledWith({
      type: 'danger',
      message: 'La receta está incompleta: complétala antes de activarla.',
    });
  });

  it('sin la categoría, el Operador ve que debe pedírselo a un administrador (criterio 9)', async () => {
    recipesApi['variables'].mockReturnValue(
      of({ category: null, variables: [], excludedCount: 0 }),
    );
    await renderPage('Operador');

    expect(await screen.findByText(/no tiene la categoría/)).toBeInTheDocument();
    expect(
      screen.getByText('Pide a un administrador que importe las categorías.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nueva receta' })).not.toBeInTheDocument();
  });

  it('sin la categoría, un administrador tiene el enlace a las categorías', async () => {
    recipesApi['variables'].mockReturnValue(
      of({ category: null, variables: [], excludedCount: 0 }),
    );
    await renderPage('AdminCliente');

    expect(
      await screen.findByRole('link', { name: 'Ir a las categorías de variables' }),
    ).toHaveAttribute('href', '/config/machines/machine-1/variable-categories');
  });

  it('pagina de 20 en 20', async () => {
    recipesApi['list'].mockImplementation(
      (...[, params]: [string, { limit: number; offset: number }]) =>
        of({ data: [summary()], total: 45, limit: params.limit, offset: params.offset }),
    );
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Siguiente' }));

    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(recipesApi['list']).toHaveBeenLastCalledWith('machine-1', { limit: 20, offset: 20 });
  });

  it('cambiar de Machine recarga sus recetas', async () => {
    await renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Máquina'), 'machine-2');

    expect(recipesApi['variables']).toHaveBeenLastCalledWith('machine-2');
    expect(storage.setItem).toHaveBeenLastCalledWith(SELECTED_MACHINE_KEY, 'machine-2');
  });
});

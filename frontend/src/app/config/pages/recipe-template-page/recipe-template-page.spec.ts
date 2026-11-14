import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { RecipeTemplateApiService } from '../../../recipes/adapters/recipe-template-api.service';
import {
  RecipeTemplate,
  RecipeTemplateVariable,
  RecipeVariableConfig,
} from '../../../recipes/entities/recipe-template.model';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipeTemplatePage } from './recipe-template-page';

function variable(
  name: string,
  dataType: string,
  config: Partial<RecipeVariableConfig> = {},
  extra: Partial<RecipeTemplateVariable> = {},
): RecipeTemplateVariable {
  return {
    signalVariableName: name,
    dataType,
    comment: null,
    mappingMin: null,
    mappingMax: null,
    isUnconfigured: false,
    suggestedOptions: null,
    suggestedBooleanLabels: null,
    ...extra,
    config: {
      mode: 'EDITABLE',
      label: null,
      helpText: null,
      unit: null,
      decimals: null,
      min: null,
      max: null,
      minLength: null,
      maxLength: null,
      booleanLabels: null,
      options: null,
      defaultValue: null,
      fixedValue: null,
      ...config,
    },
  };
}

function template(overrides: Partial<RecipeTemplate> = {}): RecipeTemplate {
  return {
    category: { id: 'cat', name: 'Programación para la receta' },
    isDefault: false,
    version: 4,
    updatedAt: '2026-11-14T10:00:00Z',
    updatedByEmail: 'demo@ewcontrol.local',
    variables: [
      variable('rEspiras', 'Float', { label: 'Espiras' }, { mappingMin: 0, mappingMax: 1000 }),
      variable('xSentido', 'Boolean', { mode: 'FIXED_HIDDEN', fixedValue: true }),
      variable('rNueva', 'Float', { mode: 'HIDDEN' }, { isUnconfigured: true }),
    ],
    layout: {
      rows: [
        { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
        { items: [{ type: 'VARIABLE', span: 6, signalVariableName: 'rEspiras' }] },
      ],
    },
    removedVariables: [],
    staleConfig: [],
    excludedCount: 0,
    ...overrides,
  };
}

const NO_IMPACT = {
  recipesBecomingIncomplete: 0,
  activeRecipeBecomingIncomplete: null,
  examples: [],
};

describe('RecipeTemplatePage (docs/specs/26-receta-base.md)', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let toasts: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      get: vi.fn().mockReturnValue(of(template())),
      impact: vi.fn().mockReturnValue(of(NO_IMPACT)),
      save: vi.fn().mockReturnValue(of(template({ version: 5 }))),
    };
    toasts = { show: vi.fn() };
  });

  async function renderPage() {
    const result = await render(RecipeTemplatePage, {
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RecipeTemplateApiService, useValue: api },
        { provide: ToastService, useValue: toasts },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ machineId: 'machine-1' }) } },
        },
      ],
    });
    await screen.findByRole('tablist');
    return result;
  }

  it('resume los modos, avisa de las variables nuevas y enseña la última modificación', async () => {
    await renderPage();

    const summary = screen.getByRole('list', { name: 'Resumen de la receta base' });
    expect(within(summary).getByText('Editable').closest('li')).toHaveTextContent('1 Editable');
    expect(within(summary).getByText('Oculta').closest('li')).toHaveTextContent('1 Oculta');
    expect(screen.getByText(/Hay 1 variable nueva sin configurar/)).toBeInTheDocument();
    expect(screen.getByText(/demo@ewcontrol.local/)).toBeInTheDocument();
  });

  it('avisa si usa la receta base por defecto, de las eliminadas y de lo que ya no vale', async () => {
    api['get'].mockReturnValue(
      of(
        template({
          isDefault: true,
          removedVariables: ['xBorrada'],
          staleConfig: [
            { signalVariableName: 'xSentido', field: 'fixedValue', reason: 'INVALID_FIXED_VALUE' },
          ],
        }),
      ),
    );
    await renderPage();

    expect(screen.getByText(/usa la receta base por defecto/)).toBeInTheDocument();
    expect(screen.getByText(/se quitarán al guardar: xBorrada/)).toBeInTheDocument();
    expect(screen.getByText(/el valor fijo ya no es válido/)).toBeInTheDocument();
  });

  it('las pestañas se recorren con las flechas del teclado', async () => {
    await renderPage();

    const variables = screen.getByRole('tab', { name: 'Variables' });
    expect(variables).toHaveAttribute('aria-selected', 'true');
    variables.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'Disposición' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tabpanel', { name: 'Disposición' })).toBeInTheDocument();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Vista previa' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Variables' })).toHaveAttribute('aria-selected', 'true');
  });

  it('filtra por texto y por modo, y «Ver solo las nuevas» deja solo las sin configurar', async () => {
    await renderPage();

    await userEvent.type(screen.getByLabelText('Buscar una variable'), 'espir');
    expect(screen.getByText('1 de 3 variables')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar una variable'));

    await userEvent.click(screen.getByRole('button', { name: 'Ver solo las nuevas' }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'rNueva' })).toBeInTheDocument();
  });

  it('hacer visible una variable la coloca en la disposición, y ocultarla la quita', async () => {
    await renderPage();

    const nueva = screen.getByRole('article', { name: 'rNueva' });
    await userEvent.click(within(nueva).getByRole('radio', { name: 'Editable' }));
    const espiras = screen.getByRole('article', { name: /Espiras/ });
    await userEvent.click(within(espiras).getByRole('radio', { name: 'Oculta' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Disposición' }));
    expect(screen.getByText('rNueva')).toBeInTheDocument();
    expect(screen.queryByText('Espiras')).not.toBeInTheDocument();
  });

  it('la vista previa pinta el formulario y cambia de dispositivo', async () => {
    const { container } = await renderPage();

    await userEvent.click(screen.getByRole('tab', { name: 'Vista previa' }));

    expect(screen.getByRole('heading', { name: 'Bobinado' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Espiras' })).toBeInTheDocument();
    expect(screen.getByText(/2 variables no aparecen/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Móvil' }));
    expect(container.querySelector('.recipe-layout')).toHaveClass('recipe-layout--mobile');
  });

  it('guarda directamente si no deja recetas incompletas', async () => {
    const { fixture } = await renderPage();
    const espiras = screen.getByRole('article', { name: /Espiras/ });
    await userEvent.click(within(espiras).getByRole('radio', { name: 'Fija y visible' }));
    await userEvent.type(within(espiras).getByRole('spinbutton', { name: 'Valor fijo' }), '12');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar receta base' }));

    expect(api['impact']).toHaveBeenCalled();
    expect(api['save']).toHaveBeenCalledWith(
      'machine-1',
      expect.objectContaining({
        version: 4,
        variables: expect.arrayContaining([
          expect.objectContaining({
            signalVariableName: 'rEspiras',
            mode: 'FIXED_VISIBLE',
            fixedValue: 12,
          }),
        ]),
      }),
    );
    expect(toasts.show).toHaveBeenCalledWith({ type: 'success', message: 'Receta base guardada.' });
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('si deja recetas incompletas pide confirmación antes de guardar', async () => {
    api['impact'].mockReturnValue(
      of({
        recipesBecomingIncomplete: 2,
        activeRecipeBecomingIncomplete: { id: 'r', title: 'Bobina 120' },
        examples: ['Bobina 120', 'Bobina 80'],
      }),
    );
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar receta base' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Este cambio deja 2 recetas incompletas');
    expect(dialog).toHaveTextContent('«Bobina 120»');
    expect(api['save']).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar igualmente' }));
    expect(api['save']).toHaveBeenCalled();
  });

  it('valida en el cliente, abre la pestaña con errores y no llama a la API', async () => {
    await renderPage();
    const espiras = screen.getByRole('article', { name: /Espiras/ });
    await userEvent.click(within(espiras).getByRole('radio', { name: 'Fija y oculta' }));

    await userEvent.click(screen.getByRole('button', { name: 'Guardar receta base' }));

    expect(api['impact']).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /Variables/ })).toHaveTextContent('1');
    expect(
      within(espiras).getByRole('spinbutton', { name: 'Valor fijo' }),
    ).toHaveAccessibleDescription(/Un valor fijo es obligatorio/);
  });

  it('marca los errores del Backend en su sitio', async () => {
    api['impact'].mockReturnValue(
      throwError(() => ({
        status: 400,
        code: 'INVALID_RECIPE_TEMPLATE',
        message: '',
        details: [{ row: 0, item: 0, reason: 'TEXT_REQUIRED' }],
      })),
    );
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar receta base' }));

    expect(screen.getByRole('tab', { name: /Disposición/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Escribe el texto.')).toBeInTheDocument();
    expect(screen.getByText('Revisa los ajustes marcados.')).toBeInTheDocument();
  });

  it('una edición simultánea ofrece recargar o seguir editando', async () => {
    api['save'].mockReturnValue(
      throwError(() => ({ status: 409, code: 'RECIPE_TEMPLATE_MODIFIED', message: '' })),
    );
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar receta base' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Otra persona ha guardado cambios');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Recargar la receta base' }));
    expect(api['get']).toHaveBeenCalledTimes(2);
  });

  it('sin variables de receta remite a las categorías', async () => {
    api['get'].mockReturnValue(of(template({ category: null, variables: [] })));
    await render(RecipeTemplatePage, {
      providers: [
        provideRouter([]),
        { provide: RecipeTemplateApiService, useValue: api },
        { provide: ToastService, useValue: toasts },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ machineId: 'machine-1' }) } },
        },
      ],
    });

    expect(
      await screen.findByRole('link', { name: 'Ir a las categorías de variables' }),
    ).toHaveAttribute('href', '/config/machines/machine-1/variable-categories');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('un error al cargar se muestra', async () => {
    api['get'].mockReturnValue(
      throwError(() => ({ status: 404, code: 'MACHINE_NOT_FOUND', message: '' })),
    );
    await render(RecipeTemplatePage, {
      providers: [
        provideRouter([]),
        { provide: RecipeTemplateApiService, useValue: api },
        { provide: ToastService, useValue: toasts },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ machineId: 'machine-1' }) } },
        },
      ],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('La máquina no existe.');
  });
});

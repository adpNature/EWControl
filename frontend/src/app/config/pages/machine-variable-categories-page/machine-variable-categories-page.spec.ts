import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { VariableCategoriesApiService } from '../../adapters/variable-categories-api.service';
import { VariableCategoryList } from '../../entities/variable-category.model';
import { MachineVariableCategoriesPage } from './machine-variable-categories-page';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const LIST: VariableCategoryList = {
  categories: [
    {
      id: 'c-1',
      parentId: null,
      name: 'Pagina programación receta',
      position: 0,
      variableCount: 3,
    },
    {
      id: 'c-2',
      parentId: 'c-1',
      name: 'Programacion para la receta',
      position: 1,
      variableCount: 3,
    },
    { id: 'c-3', parentId: null, name: 'Datos del HMI', position: 2, variableCount: 10 },
  ],
  variables: [],
};
const SUMMARY = {
  categories: 8,
  subcategories: 16,
  variables: 428,
  categorized: 408,
  uncategorized: 20,
  withComment: 70,
};

describe('MachineVariableCategoriesPage (docs/specs/23-categorias-variables-plc.md)', () => {
  let categoriesApi: {
    list: ReturnType<typeof vi.fn>;
    import: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
  };
  let machinesApi: { getConnection: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    categoriesApi = {
      list: vi.fn().mockReturnValue(of(LIST)),
      import: vi.fn().mockReturnValue(of(SUMMARY)),
      rename: vi.fn((...args: unknown[]) =>
        of({ ...LIST.categories.find((category) => category.id === args[1]), name: args[2] }),
      ),
    };
    machinesApi = {
      getConnection: vi.fn().mockReturnValue(
        of({
          id: 'conn-1',
          machineId: 'machine-1',
          providerType: 'OpcUa',
          connectionConfig: {
            endpointUrl: 'opc.tcp://192.168.1.1:4840',
            securityMode: 'None',
            securityPolicy: 'None',
            authMode: 'Anonymous',
            timeoutMs: 5000,
            samplingIntervalMs: 1000,
            nodeMapping: [],
            variableSyncRootNodeId: ROOT,
          },
        }),
      ),
    };
    toastService = { show: vi.fn() };
  });

  function renderPage() {
    return render(MachineVariableCategoriesPage, {
      providers: [
        provideHttpClient(),
        { provide: VariableCategoriesApiService, useValue: categoriesApi },
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: ToastService, useValue: toastService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'machine-1' } } },
        },
      ],
    });
  }

  function csvFile(content: string): File {
    return new File([content], 'GVL_HMI.csv', { type: 'text/csv' });
  }

  it('muestra el árbol con subcategorías anidadas y su número de variables (criterio 2)', async () => {
    await renderPage();

    const tree = screen.getByRole('list', { name: 'Categorías de variables' });
    const parent = within(tree).getAllByRole('listitem')[0];
    expect(
      within(parent).getByLabelText('Nombre de la categoría Pagina programación receta'),
    ).toHaveValue('Pagina programación receta');
    expect(
      within(parent).getByLabelText('Nombre de la categoría Programacion para la receta'),
    ).toBeInTheDocument();
    expect(within(parent).getAllByText('3 variables')).toHaveLength(2);
    expect(screen.getByText('10 variables')).toBeInTheDocument();
  });

  it('renombra una categoría y deshabilita «Guardar» si el nombre no cambia (criterio 2)', async () => {
    const user = userEvent.setup();
    await renderPage();
    const save = screen.getByRole('button', {
      name: 'Guardar el nombre de Pagina programación receta',
    });
    expect(save).toBeDisabled();

    const input = screen.getByLabelText('Nombre de la categoría Pagina programación receta');
    await user.clear(input);
    await user.type(input, 'Página programación receta');
    await user.click(save);

    expect(categoriesApi.rename).toHaveBeenCalledWith(
      'machine-1',
      'c-1',
      'Página programación receta',
    );
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Categoría renombrada.',
    });
    expect(
      screen.getByRole('button', { name: 'Guardar el nombre de Página programación receta' }),
    ).toBeDisabled();
  });

  it('un error al renombrar se muestra en la fila (criterio 2)', async () => {
    const user = userEvent.setup();
    categoriesApi.rename.mockReturnValue(
      throwError(() => ({ status: 409, code: 'VARIABLE_CATEGORY_NAME_TAKEN', message: '' })),
    );
    await renderPage();
    const input = screen.getByLabelText('Nombre de la categoría Datos del HMI');
    await user.type(input, ' 2');

    await user.click(screen.getByRole('button', { name: 'Guardar el nombre de Datos del HMI' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ya hay otra categoría con ese nombre en el mismo nivel.',
    );
    expect(input).toHaveValue('Datos del HMI 2');
  });

  it('propone la carpeta guardada y no deja importar sin fichero', async () => {
    await renderPage();

    expect(screen.getByLabelText('Carpeta OPC UA (NodeId)')).toHaveValue(ROOT);
    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
  });

  it('con categorías, importar pide confirmación y envía el CSV decodificado (criterio 1)', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.upload(screen.getByLabelText('Fichero CSV de la GVL'), csvFile('Type,Name\n'));
    await user.click(screen.getByRole('button', { name: 'Importar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Se sustituirán las categorías actuales y sus nombres');
    await user.click(within(dialog).getByRole('button', { name: 'Importar' }));

    await waitFor(() =>
      expect(categoriesApi.import).toHaveBeenCalledWith('machine-1', {
        rootNodeId: ROOT,
        csv: 'Type,Name\n',
      }),
    );
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Importadas 8 categorías, 16 subcategorías y 428 variables (20 sin categoría).',
    });
    expect(categoriesApi.list).toHaveBeenCalledTimes(2);
  });

  it('sin categorías, importa sin confirmación y explica cómo empezar', async () => {
    const user = userEvent.setup();
    categoriesApi.list.mockReturnValue(of({ categories: [], variables: [] }));
    await renderPage();
    expect(screen.getByText(/Todavía no hay categorías/)).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Fichero CSV de la GVL'), csvFile('x'));
    await user.click(screen.getByRole('button', { name: 'Importar' }));

    await waitFor(() => expect(categoriesApi.import).toHaveBeenCalled());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('un error al importar se muestra como alerta sin tocar el árbol', async () => {
    const user = userEvent.setup();
    categoriesApi.list.mockReturnValue(of({ categories: [], variables: [] }));
    categoriesApi.import.mockReturnValue(
      throwError(() => ({
        status: 400,
        code: 'INVALID_GVL_EXPORT',
        message: '',
        details: { reason: 'El CSV no tiene la columna Comment.' },
      })),
    );
    await renderPage();

    await user.upload(screen.getByLabelText('Fichero CSV de la GVL'), csvFile('x'));
    await user.click(screen.getByRole('button', { name: 'Importar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El CSV no tiene la columna Comment.',
    );
    expect(categoriesApi.list).toHaveBeenCalledTimes(1);
  });
});

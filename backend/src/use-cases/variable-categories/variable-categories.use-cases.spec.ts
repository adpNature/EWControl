import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { MachineInactiveError } from '../machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../machine-management/errors/machine-not-found.error';
import { InvalidGvlExportError } from './errors/invalid-gvl-export.error';
import { InvalidVariableCategoryNameError } from './errors/invalid-variable-category-name.error';
import { VariableCategoryNameTakenError } from './errors/variable-category-name-taken.error';
import { VariableCategoryNotFoundError } from './errors/variable-category-not-found.error';
import {
  ImportVariableCategoriesUseCase,
  ListVariableCategoriesUseCase,
  RenameVariableCategoryUseCase,
} from './variable-categories.use-cases';

const FAKE_CTX = Symbol('tx-ctx');
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const MACHINE = { id: 'machine-1', companyId: 'company-1', isActive: true };
const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);
const CSV = [
  'Type,Name,Address,DataType,InitValue,Comment,Attribute',
  'VAR_GLOBAL,xLibre,,BOOL,,,',
  `VAR_GLOBAL,iPagina,,INT,,"${HASH}\n PAGINA RECETA \n${HASH}\n${STAR}\n PROGRAMACION \n${STAR}",`,
  'VAR_GLOBAL,xHome,,BOOL,,Home,',
].join('\n');

const CATEGORIES = [
  { id: 'c-1', machineId: 'machine-1', parentId: null, name: 'Página receta', position: 0 },
  { id: 'c-2', machineId: 'machine-1', parentId: 'c-1', name: 'Programación', position: 1 },
  { id: 'c-3', machineId: 'machine-1', parentId: 'c-1', name: 'Límites', position: 2 },
  { id: 'c-4', machineId: 'machine-1', parentId: null, name: 'Datos del HMI', position: 3 },
];
const ENTRIES = [
  {
    machineId: 'machine-1',
    nodeId: `${ROOT}.xLibre`,
    categoryId: null,
    comment: null,
    position: 0,
  },
  { machineId: 'machine-1', nodeId: `${ROOT}.a`, categoryId: 'c-2', comment: null, position: 1 },
  { machineId: 'machine-1', nodeId: `${ROOT}.b`, categoryId: 'c-2', comment: 'Home', position: 2 },
  { machineId: 'machine-1', nodeId: `${ROOT}.c`, categoryId: 'c-3', comment: null, position: 3 },
  { machineId: 'machine-1', nodeId: `${ROOT}.d`, categoryId: 'c-1', comment: null, position: 4 },
];

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(MACHINE) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const repository = {
    replaceForMachine: vi.fn().mockResolvedValue(undefined),
    listCategories: vi.fn().mockResolvedValue(CATEGORIES),
    listEntries: vi.fn().mockResolvedValue(ENTRIES),
    findCategory: vi.fn(
      async (_machineId: string, id: string) =>
        CATEGORIES.find((category) => category.id === id) ?? null,
    ),
    rename: vi.fn(async (id: string, name: string) => ({
      ...CATEGORIES.find((category) => category.id === id)!,
      name,
    })),
  };
  return { resolver, unitOfWork, repository };
}

type Fakes = ReturnType<typeof createFakes>;
const importUseCase = (fakes: Fakes) =>
  new ImportVariableCategoriesUseCase(fakes.resolver as never, fakes.unitOfWork, fakes.repository);
const listUseCase = (fakes: Fakes) =>
  new ListVariableCategoriesUseCase(fakes.resolver as never, fakes.unitOfWork, fakes.repository);
const renameUseCase = (fakes: Fakes) =>
  new RenameVariableCategoryUseCase(fakes.resolver as never, fakes.unitOfWork, fakes.repository);

describe('ImportVariableCategoriesUseCase (docs/specs/23-categorias-variables-plc.md)', () => {
  const INPUT = { machineId: 'machine-1', requester: REQUESTER, rootNodeId: ROOT, csv: CSV };

  it('sustituye categorías y catálogo con los NodeId de la carpeta y devuelve el resumen (criterio 4)', async () => {
    const fakes = createFakes();

    const summary = await importUseCase(fakes).execute(INPUT);

    expect(fakes.resolver.resolveAny).toHaveBeenCalledWith('machine-1', REQUESTER, FAKE_CTX);
    expect(fakes.repository.replaceForMachine).toHaveBeenCalledWith(
      'machine-1',
      [
        { key: 0, parentKey: null, name: 'Pagina receta', position: 0 },
        { key: 1, parentKey: 0, name: 'Programacion', position: 1 },
      ],
      [
        { nodeId: `${ROOT}.xLibre`, categoryKey: null, comment: null, position: 0 },
        { nodeId: `${ROOT}.iPagina`, categoryKey: 1, comment: null, position: 1 },
        { nodeId: `${ROOT}.xHome`, categoryKey: 1, comment: 'Home', position: 2 },
      ],
      FAKE_CTX,
    );
    expect(summary).toEqual({
      categories: 1,
      subcategories: 1,
      variables: 3,
      categorized: 2,
      uncategorized: 1,
      withComment: 1,
    });
  });

  it('recorta la carpeta antes de componer los NodeId', async () => {
    const fakes = createFakes();

    await importUseCase(fakes).execute({ ...INPUT, rootNodeId: `  ${ROOT}  ` });

    const entries = fakes.repository.replaceForMachine.mock.calls[0][2];
    expect(entries[0].nodeId).toBe(`${ROOT}.xLibre`);
  });

  it.each([
    ['un CSV no válido', { csv: 'Type,Name\nVAR_GLOBAL,a' }, /Comment/],
    ['un CSV demasiado largo', { csv: 'x'.repeat(90_001) }, /90000/],
    ['una carpeta vacía', { rootNodeId: '   ' }, /carpeta/],
    ['una carpeta demasiado larga', { rootNodeId: 'x'.repeat(1025) }, /carpeta/],
  ])(
    'rechaza %s con InvalidGvlExportError sin tocar nada (criterio 5)',
    async (_label, overrides, reason) => {
      const fakes = createFakes();

      const promise = importUseCase(fakes).execute({ ...INPUT, ...overrides });

      await expect(promise).rejects.toBeInstanceOf(InvalidGvlExportError);
      await expect(promise).rejects.toMatchObject({ reason: expect.stringMatching(reason) });
      expect(fakes.repository.replaceForMachine).not.toHaveBeenCalled();
    },
  );

  it('rechaza una Machine desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...MACHINE, isActive: false });

    await expect(importUseCase(fakes).execute(INPUT)).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.repository.replaceForMachine).not.toHaveBeenCalled();
  });

  it('propaga MachineNotFoundError si la Machine no es accesible', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockRejectedValue(new MachineNotFoundError('machine-1'));

    await expect(importUseCase(fakes).execute(INPUT)).rejects.toBeInstanceOf(MachineNotFoundError);
  });
});

describe('ListVariableCategoriesUseCase (spec 23, criterio 6)', () => {
  it('devuelve las categorías con su número de variables (las raíz incluyen las de sus hijas) y el catálogo', async () => {
    const fakes = createFakes();

    const result = await listUseCase(fakes).execute({
      machineId: 'machine-1',
      requester: REQUESTER,
    });

    expect(result.categories).toEqual([
      { id: 'c-1', parentId: null, name: 'Página receta', position: 0, variableCount: 4 },
      { id: 'c-2', parentId: 'c-1', name: 'Programación', position: 1, variableCount: 2 },
      { id: 'c-3', parentId: 'c-1', name: 'Límites', position: 2, variableCount: 1 },
      { id: 'c-4', parentId: null, name: 'Datos del HMI', position: 3, variableCount: 0 },
    ]);
    expect(result.variables[2]).toEqual({
      nodeId: `${ROOT}.b`,
      categoryId: 'c-2',
      comment: 'Home',
      position: 2,
    });
    expect(fakes.repository.listCategories).toHaveBeenCalledWith('machine-1', FAKE_CTX);
  });

  it('una Machine desactivada también se puede consultar', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...MACHINE, isActive: false });

    await expect(
      listUseCase(fakes).execute({ machineId: 'machine-1', requester: REQUESTER }),
    ).resolves.toBeDefined();
  });
});

describe('RenameVariableCategoryUseCase (spec 23, criterio 7)', () => {
  const INPUT = {
    machineId: 'machine-1',
    categoryId: 'c-2',
    requester: REQUESTER,
    name: '  Programación para la receta  ',
  };

  it('renombra con el nombre recortado', async () => {
    const fakes = createFakes();

    const category = await renameUseCase(fakes).execute(INPUT);

    expect(fakes.repository.findCategory).toHaveBeenCalledWith('machine-1', 'c-2', FAKE_CTX);
    expect(fakes.repository.rename).toHaveBeenCalledWith(
      'c-2',
      'Programación para la receta',
      FAKE_CTX,
    );
    expect(category.name).toBe('Programación para la receta');
  });

  it('permite cambiar solo mayúsculas o tildes de su propio nombre', async () => {
    const fakes = createFakes();

    await renameUseCase(fakes).execute({ ...INPUT, name: 'PROGRAMACIÓN' });

    expect(fakes.repository.rename).toHaveBeenCalled();
  });

  it.each([[''], ['   '], ['x'.repeat(121)]])(
    'rechaza el nombre %o con InvalidVariableCategoryNameError',
    async (name) => {
      const fakes = createFakes();

      await expect(renameUseCase(fakes).execute({ ...INPUT, name })).rejects.toBeInstanceOf(
        InvalidVariableCategoryNameError,
      );
      expect(fakes.repository.rename).not.toHaveBeenCalled();
    },
  );

  it('rechaza el nombre de una hermana (sin distinguir mayúsculas) con VariableCategoryNameTakenError', async () => {
    const fakes = createFakes();

    await expect(
      renameUseCase(fakes).execute({ ...INPUT, name: 'límites' }),
    ).rejects.toBeInstanceOf(VariableCategoryNameTakenError);
    expect(fakes.repository.rename).not.toHaveBeenCalled();
  });

  it('el nombre de una categoría de otro nivel no cuenta como repetido', async () => {
    const fakes = createFakes();

    await renameUseCase(fakes).execute({ ...INPUT, name: 'Datos del HMI' });

    expect(fakes.repository.rename).toHaveBeenCalled();
  });

  it('responde VariableCategoryNotFoundError si la categoría no es de esa Machine', async () => {
    const fakes = createFakes();

    await expect(
      renameUseCase(fakes).execute({ ...INPUT, categoryId: 'otra' }),
    ).rejects.toBeInstanceOf(VariableCategoryNotFoundError);
  });

  it('rechaza una Machine desactivada', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...MACHINE, isActive: false });

    await expect(renameUseCase(fakes).execute(INPUT)).rejects.toBeInstanceOf(MachineInactiveError);
  });
});

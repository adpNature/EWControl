import { vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../../src/entities/connection-config.vo';
import type { Recipe } from '../../src/entities/recipe.entity';
import { ProviderType } from '../../src/entities/provider-type.enum';
import { UserRole } from '../../src/entities/user-role.enum';
import { RecipeAccessResolver } from '../../src/use-cases/recipes/recipe-access.resolver';

/** Fakes compartidos por los specs de `recipes` (no es código de producción). */
export const FAKE_CTX = Symbol('tx-ctx');
export const REQUESTER = { companyId: 'company-1', role: UserRole.Operador };
export const NOW = new Date('2026-11-13T12:00:00Z');
export const MACHINE = {
  id: 'machine-1',
  companyId: 'company-1',
  name: 'Bobinadora',
  isActive: true,
};

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

export const CATEGORIES = [
  {
    id: 'root',
    machineId: 'machine-1',
    parentId: null,
    name: 'Página programación receta',
    position: 1,
  },
  {
    id: 'recipe',
    machineId: 'machine-1',
    parentId: 'root',
    name: 'Programación para la receta',
    position: 2,
  },
];

export const ENTRIES = [
  {
    machineId: 'machine-1',
    nodeId: `${ROOT}.rEspiras`,
    categoryId: 'recipe',
    comment: null,
    position: 1,
  },
  {
    machineId: 'machine-1',
    nodeId: `${ROOT}.xSentidoCabezal`,
    categoryId: 'recipe',
    comment: '2 opciones: 0 - Horario / 1 - Antihorario',
    position: 2,
  },
];

export const CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    {
      nodeId: `${ROOT}.rEspiras`,
      signalVariableName: 'rEspiras',
      dataType: 'Float',
      min: 0,
      max: 10000,
    },
    {
      nodeId: `${ROOT}.xSentidoCabezal`,
      signalVariableName: 'xSentidoCabezal',
      dataType: 'Boolean',
    },
  ],
};

export const VALUES = [
  { signalVariableName: 'rEspiras', value: 350 },
  { signalVariableName: 'xSentidoCabezal', value: false },
];

export const RECIPE: Recipe = {
  id: 'recipe-1',
  machineId: 'machine-1',
  machine: undefined as never,
  title: 'Bobina 120',
  titleKey: 'bobina 120',
  description: null,
  searchKey: 'bobina 120',
  values: VALUES,
  isActivated: false,
  activatedAt: null,
  activatedByEmail: null,
  version: 3,
  createdAt: NOW,
  createdByEmail: 'demo@ewcontrol.local',
  updatedAt: NOW,
  updatedByEmail: 'demo@ewcontrol.local',
};

export function createRecipeFakes(
  options: { categories?: unknown[]; recipe?: Partial<Recipe> } = {},
) {
  const recipe = { ...RECIPE, ...options.recipe };
  const machineAccessResolver = { resolveActive: vi.fn().mockResolvedValue(MACHINE) };
  const categoryRepository = {
    listCategories: vi.fn().mockResolvedValue(options.categories ?? CATEGORIES),
    listEntries: vi.fn().mockResolvedValue(ENTRIES),
  };
  const connectionRepository = {
    findByMachineId: vi.fn().mockResolvedValue({
      machineId: 'machine-1',
      providerType: ProviderType.OpcUa,
      connectionConfig: CONFIG,
    }),
  };
  const recipeRepository = {
    countByMachine: vi.fn().mockResolvedValue(1),
    findById: vi.fn().mockResolvedValue(recipe),
    findByTitleKey: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue({ data: [recipe], total: 1 }),
    create: vi.fn((data: Record<string, unknown>) =>
      Promise.resolve({ ...RECIPE, id: 'recipe-new', version: 1, ...data }),
    ),
    update: vi.fn((id: string, _version: number, data: Record<string, unknown>) =>
      Promise.resolve({ ...recipe, id, version: recipe.version + 1, ...data }),
    ),
    delete: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn(() =>
      Promise.resolve({ ...recipe, isActivated: true, activatedAt: NOW, activatedByEmail: 'op@x' }),
    ),
    deactivate: vi.fn(() => Promise.resolve({ ...recipe, isActivated: false })),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: () => NOW };
  const access = new RecipeAccessResolver(
    machineAccessResolver as never,
    categoryRepository as never,
    connectionRepository as never,
    recipeRepository as never,
  );
  return {
    machineAccessResolver,
    categoryRepository,
    connectionRepository,
    recipeRepository,
    unitOfWork,
    clock,
    access,
  };
}

import { describe, expect, it, vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../../entities/connection-config.vo';
import { ProviderType } from '../../entities/provider-type.enum';
import { SignalType } from '../../entities/signal-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { InvalidConnectionConfigError } from './errors/invalid-connection-config.error';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { MachineNotOpcUaError } from './errors/machine-not-opc-ua.error';
import { OpcUaEndpointNotAllowedError } from './errors/opc-ua-endpoint-not-allowed.error';
import { OpcUaInvalidNodeIdError } from './errors/opc-ua-invalid-node-id.error';
import { OpcUaMappingLimitError } from './errors/opc-ua-mapping-limit.error';
import { OpcUaVariableInUseError } from './errors/opc-ua-variable-in-use.error';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import { SaveOpcUaVariablesUseCase } from './save-opc-ua-variables.use-case';
import { OPCUA_SYNC_LIMITS, SyncOpcUaVariablesUseCase } from './sync-opc-ua-variables.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const ENDPOINT = 'opc.tcp://192.168.1.1:4840';
const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const NOW = new Date('2026-11-07T10:00:00.000Z');

function nodeId(name: string) {
  return `${ROOT}.${name}`;
}

function opcUaConfig(overrides: Partial<OpcUaConnectionConfig> = {}): OpcUaConnectionConfig {
  return {
    endpointUrl: ENDPOINT,
    securityMode: 'None',
    securityPolicy: 'None',
    authMode: 'Anonymous',
    timeoutMs: 5000,
    samplingIntervalMs: 1000,
    nodeMapping: [
      { nodeId: nodeId('speed'), signalVariableName: 'GVL_HMI_speed', dataType: 'Float' },
      { nodeId: nodeId('old'), signalVariableName: 'GVL_HMI_old', dataType: 'Boolean' },
    ],
    ...overrides,
  };
}

function createFakes(
  options: {
    config?: OpcUaConnectionConfig | null;
    providerType?: ProviderType;
    allowedHosts?: string[];
  } = {},
) {
  const config = options.config === undefined ? opcUaConfig() : options.config;
  const connection =
    config === null
      ? null
      : {
          id: 'conn-1',
          machineId: 'machine-1',
          providerType: options.providerType ?? ProviderType.OpcUa,
          connectionConfig: config,
        };
  const resolver = {
    resolveActive: vi
      .fn()
      .mockResolvedValue({ id: 'machine-1', companyId: 'company-1', isActive: true }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const connectionRepository = {
    findByMachineId: vi.fn().mockResolvedValue(connection),
    replace: vi.fn(async (machineId: string, changes: object) => ({
      id: 'conn-1',
      machineId,
      ...changes,
    })),
  };
  const explorer = {
    testConnection: vi.fn(),
    browse: vi.fn(),
    scanVariables: vi.fn().mockResolvedValue({
      variables: [
        {
          nodeId: nodeId('speed'),
          path: ['GVL_HMI', 'speed'],
          dataType: 'Float',
          plcWritable: true,
        },
        {
          nodeId: nodeId('fresh'),
          path: ['GVL_HMI', 'fresh'],
          dataType: 'Int16',
          plcWritable: false,
        },
      ],
      skipped: [
        {
          nodeId: nodeId('arr'),
          path: ['GVL_HMI', 'arr'],
          dataType: 'UInt16',
          valueRank: 1,
          arrayDimensions: [4],
          reason: 'nonScalar',
        },
      ],
      existence: new Map([[nodeId('old'), false]]),
    }),
  };
  const signalRepository = { findAllByMachineId: vi.fn().mockResolvedValue([]) };
  const writePackageRepository = { listActiveByMachine: vi.fn().mockResolvedValue([]) };
  const eventPublisher = { publish: vi.fn() };
  const clock = { now: () => NOW };
  const endpointPolicy = new OpcUaEndpointPolicy(options.allowedHosts ?? []);
  return {
    resolver,
    unitOfWork,
    connectionRepository,
    explorer,
    signalRepository,
    writePackageRepository,
    eventPublisher,
    clock,
    endpointPolicy,
  };
}

type Fakes = ReturnType<typeof createFakes>;

function createSync(fakes: Fakes) {
  return new SyncOpcUaVariablesUseCase(
    fakes.resolver as never,
    fakes.unitOfWork,
    fakes.connectionRepository as never,
    fakes.endpointPolicy,
    fakes.explorer,
    fakes.clock,
  );
}

function createSave(fakes: Fakes) {
  return new SaveOpcUaVariablesUseCase(
    fakes.resolver as never,
    fakes.unitOfWork,
    fakes.connectionRepository as never,
    fakes.signalRepository as never,
    fakes.writePackageRepository as never,
    fakes.endpointPolicy,
    fakes.eventPublisher,
  );
}

describe('SyncOpcUaVariablesUseCase (docs/specs/21-sincronizacion-variables-opc-ua.md)', () => {
  const INPUT = { machineId: 'machine-1', requester: REQUESTER, rootNodeId: ROOT };

  it('recorre la carpeta con el endpoint guardado y devuelve la comparación (criterios 2-6)', async () => {
    const fakes = createFakes();

    const result = await createSync(fakes).execute(INPUT);

    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('machine-1', REQUESTER, FAKE_CTX);
    expect(fakes.explorer.scanVariables).toHaveBeenCalledWith(
      ENDPOINT,
      ROOT,
      [nodeId('speed'), nodeId('old')],
      OPCUA_SYNC_LIMITS,
    );
    expect(result.rootNodeId).toBe(ROOT);
    expect(result.syncedAt).toBe(NOW.toISOString());
    expect(result.variables.map((variable) => [variable.path[1], variable.status])).toEqual([
      ['fresh', 'new'],
      ['speed', 'unchanged'],
    ]);
    expect(result.removed.map((variable) => variable.signalVariableName)).toEqual(['GVL_HMI_old']);
    expect(result.skipped).toHaveLength(1);
    expect(result.summary).toEqual({
      total: 2,
      new: 1,
      unchanged: 1,
      typeChanged: 0,
      removed: 1,
      skipped: 1,
      byDataType: Object.fromEntries([
        ['Float', 1],
        ['Int16', 1],
      ]),
    });
    expect(fakes.connectionRepository.replace).not.toHaveBeenCalled();
  });

  it('usa límites de 2000 variables, profundidad 8 y 60 s (criterio 7, OWASP A04)', () => {
    expect(OPCUA_SYNC_LIMITS).toEqual({ timeoutMs: 60000, maxVariables: 2000, maxDepth: 8 });
  });

  it.each([
    ['sin conexión', { config: null }],
    ['del Simulador', { providerType: ProviderType.Simulator }],
  ])(
    'rechaza una Machine %s con MachineNotOpcUaError sin abrir conexión',
    async (_label, options) => {
      const fakes = createFakes(options as never);

      await expect(createSync(fakes).execute(INPUT)).rejects.toBeInstanceOf(MachineNotOpcUaError);
      expect(fakes.explorer.scanVariables).not.toHaveBeenCalled();
    },
  );

  it('no abre conexión si el endpoint guardado ya no está permitido (OWASP A10)', async () => {
    const fakes = createFakes({ allowedHosts: ['10.0.0.0/8'] });

    await expect(createSync(fakes).execute(INPUT)).rejects.toBeInstanceOf(
      OpcUaEndpointNotAllowedError,
    );
    expect(fakes.explorer.scanVariables).not.toHaveBeenCalled();
  });

  it('propaga MachineNotFoundError sin abrir conexión', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveActive.mockRejectedValue(new MachineNotFoundError('machine-1'));

    await expect(createSync(fakes).execute(INPUT)).rejects.toBeInstanceOf(MachineNotFoundError);
    expect(fakes.explorer.scanVariables).not.toHaveBeenCalled();
  });

  it.each(['', '   ', 'x'.repeat(1025)])(
    'rechaza un rootNodeId vacío o demasiado largo con OpcUaInvalidNodeIdError',
    async (rootNodeId) => {
      const fakes = createFakes();

      await expect(createSync(fakes).execute({ ...INPUT, rootNodeId })).rejects.toBeInstanceOf(
        OpcUaInvalidNodeIdError,
      );
      expect(fakes.explorer.scanVariables).not.toHaveBeenCalled();
    },
  );
});

describe('SaveOpcUaVariablesUseCase (docs/specs/21-sincronizacion-variables-opc-ua.md)', () => {
  const BASE_INPUT = {
    machineId: 'machine-1',
    requester: REQUESTER,
    rootNodeId: ROOT,
    variables: [
      {
        nodeId: nodeId('speed'),
        signalVariableName: 'GVL_HMI_speed',
        label: 'Velocidad',
        dataType: 'Float',
      },
      {
        nodeId: nodeId('fresh'),
        signalVariableName: 'GVL_HMI_fresh',
        label: null,
        dataType: 'Int16',
      },
    ],
    remove: [nodeId('old')],
  };

  it('fusiona, guarda la carpeta raíz y publica MachineConnectionReplaced (criterio 8)', async () => {
    const fakes = createFakes();

    const connection = await createSave(fakes).execute(BASE_INPUT);

    const saved = fakes.connectionRepository.replace.mock.calls[0];
    expect(saved[0]).toBe('machine-1');
    expect(saved[1]).toEqual({
      providerType: ProviderType.OpcUa,
      connectionConfig: {
        ...opcUaConfig(),
        variableSyncRootNodeId: ROOT,
        nodeMapping: [
          {
            nodeId: nodeId('speed'),
            signalVariableName: 'GVL_HMI_speed',
            label: 'Velocidad',
            dataType: 'Float',
          },
          { nodeId: nodeId('fresh'), signalVariableName: 'GVL_HMI_fresh', dataType: 'Int16' },
        ],
      },
    });
    expect(saved[2]).toBe(FAKE_CTX);
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineConnectionReplaced', {
      machineId: 'machine-1',
      companyId: 'company-1',
      previousProviderType: ProviderType.OpcUa,
      providerType: ProviderType.OpcUa,
    });
    expect(connection.machineId).toBe('machine-1');
  });

  it('bloquea quitar o renombrar variables que usan Signals o paquetes activos (criterio 9)', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findAllByMachineId.mockResolvedValue([
      {
        id: 's-1',
        name: 'Antigua',
        isActive: true,
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'GVL_HMI_old' },
      },
      {
        id: 's-2',
        name: 'Fórmula',
        isActive: true,
        signalType: SignalType.FORMULA,
        signalSource: { expression: 'GVL_HMI_speed * 2', variables: ['GVL_HMI_speed'] },
      },
      {
        id: 's-3',
        name: 'Dada de baja',
        isActive: false,
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'GVL_HMI_old' },
      },
    ]);
    fakes.writePackageRepository.listActiveByMachine.mockResolvedValue([
      { id: 'p-1', name: 'Formato', items: [{ signalVariableName: 'GVL_HMI_speed', value: 1 }] },
    ]);

    const promise = createSave(fakes).execute({
      ...BASE_INPUT,
      variables: [{ ...BASE_INPUT.variables[0], signalVariableName: 'Velocidad' }],
    });

    await expect(promise).rejects.toBeInstanceOf(OpcUaVariableInUseError);
    const error = (await promise.catch((caught: unknown) => caught)) as OpcUaVariableInUseError;
    expect(error.variables).toEqual([
      {
        signalVariableName: 'GVL_HMI_speed',
        usedBy: [
          { kind: 'Signal', id: 's-2', name: 'Fórmula' },
          { kind: 'WritePackage', id: 'p-1', name: 'Formato' },
        ],
      },
      {
        signalVariableName: 'GVL_HMI_old',
        usedBy: [{ kind: 'Signal', id: 's-1', name: 'Antigua' }],
      },
    ]);
    expect(fakes.connectionRepository.replace).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('cambiar solo la etiqueta o el tipo de una variable en uso no se bloquea', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findAllByMachineId.mockResolvedValue([
      {
        id: 's-1',
        name: 'Velocidad',
        isActive: true,
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'GVL_HMI_speed' },
      },
    ]);

    await createSave(fakes).execute({
      ...BASE_INPUT,
      variables: [{ ...BASE_INPUT.variables[0], label: 'Otra', dataType: 'Double' }],
      remove: [],
    });

    expect(fakes.connectionRepository.replace).toHaveBeenCalled();
  });

  it('un intercambio de nombres que sigue existiendo no se considera pérdida', async () => {
    const fakes = createFakes();
    fakes.signalRepository.findAllByMachineId.mockResolvedValue([
      {
        id: 's-1',
        name: 'Usa old',
        isActive: true,
        signalType: SignalType.DIRECT,
        signalSource: { variableName: 'GVL_HMI_old' },
      },
    ]);

    await createSave(fakes).execute({
      ...BASE_INPUT,
      variables: [
        { nodeId: nodeId('speed'), signalVariableName: 'GVL_HMI_old', dataType: 'Float' },
        { nodeId: nodeId('old'), signalVariableName: 'GVL_HMI_speed', dataType: 'Boolean' },
      ],
      remove: [],
    });

    expect(fakes.connectionRepository.replace).toHaveBeenCalled();
  });

  it('rechaza superar el máximo de entradas con OpcUaMappingLimitError', async () => {
    const fakes = createFakes();
    const variables = Array.from({ length: 499 }, (_, index) => ({
      nodeId: nodeId(`v${index}`),
      signalVariableName: `GVL_HMI_v${index}`,
      dataType: 'Boolean',
    }));

    const promise = createSave(fakes).execute({ ...BASE_INPUT, variables, remove: [] });

    await expect(promise).rejects.toBeInstanceOf(OpcUaMappingLimitError);
    await expect(promise).rejects.toMatchObject({ resultingEntries: 501, maxEntries: 500 });
    expect(fakes.connectionRepository.replace).not.toHaveBeenCalled();
  });

  it.each([
    [
      'un identificador inválido',
      { variables: [{ nodeId: nodeId('x'), signalVariableName: '1x', dataType: 'Float' }] },
    ],
    [
      'identificadores repetidos',
      {
        variables: [
          { nodeId: nodeId('a'), signalVariableName: 'GVL_HMI_speed', dataType: 'Float' },
        ],
        remove: [],
      },
    ],
    [
      'un tipo no soportado',
      { variables: [{ nodeId: nodeId('x'), signalVariableName: 'X', dataType: 'DateTime' }] },
    ],
    ['un mapeo vacío', { variables: [], remove: [nodeId('speed'), nodeId('old')] }],
    [
      'una etiqueta demasiado larga',
      { variables: [{ ...BASE_INPUT.variables[0], label: 'x'.repeat(121) }] },
    ],
  ])('rechaza %s con InvalidConnectionConfigError (criterio 10)', async (_label, overrides) => {
    const fakes = createFakes();

    await expect(createSave(fakes).execute({ ...BASE_INPUT, ...overrides })).rejects.toBeInstanceOf(
      InvalidConnectionConfigError,
    );
    expect(fakes.connectionRepository.replace).not.toHaveBeenCalled();
  });

  it('rechaza una Machine del Simulador con MachineNotOpcUaError', async () => {
    const fakes = createFakes({ providerType: ProviderType.Simulator });

    await expect(createSave(fakes).execute(BASE_INPUT)).rejects.toBeInstanceOf(
      MachineNotOpcUaError,
    );
  });

  it('rechaza el guardado si el endpoint guardado ya no está permitido', async () => {
    const fakes = createFakes({ allowedHosts: ['10.0.0.0/8'] });

    await expect(createSave(fakes).execute(BASE_INPUT)).rejects.toBeInstanceOf(
      OpcUaEndpointNotAllowedError,
    );
    expect(fakes.connectionRepository.replace).not.toHaveBeenCalled();
  });

  it('rechaza un rootNodeId vacío con OpcUaInvalidNodeIdError', async () => {
    const fakes = createFakes();

    await expect(
      createSave(fakes).execute({ ...BASE_INPUT, rootNodeId: '' }),
    ).rejects.toBeInstanceOf(OpcUaInvalidNodeIdError);
  });
});

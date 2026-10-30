import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { BrowseOpcUaNodesUseCase } from './browse-opc-ua-nodes.use-case';
import { InvalidOpcUaEndpointUrlError } from './errors/invalid-opc-ua-endpoint-url.error';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { OpcUaEndpointNotAllowedError } from './errors/opc-ua-endpoint-not-allowed.error';
import { OpcUaEndpointUnreachableError } from './errors/opc-ua-endpoint-unreachable.error';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import { TestOpcUaConnectionUseCase } from './test-opc-ua-connection.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const ENDPOINT = 'opc.tcp://192.168.1.1:4840';
const NODES = [
  {
    nodeId: 'ns=3;s="Lectura"."REAL_1"',
    browseName: 'REAL_1',
    displayName: 'REAL_1',
    nodeClass: 'Variable',
    dataType: 'Float',
    hasChildren: false,
  },
];

function createFakes(allowedHosts: string[] = []) {
  const resolver = {
    resolveActive: vi
      .fn()
      .mockResolvedValue({ id: 'machine-1', companyId: 'company-1', isActive: true }),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const explorer = {
    testConnection: vi.fn().mockResolvedValue({ reachable: true }),
    browse: vi.fn().mockResolvedValue(NODES),
  };
  const endpointPolicy = new OpcUaEndpointPolicy(allowedHosts);
  return { resolver, unitOfWork, explorer, endpointPolicy };
}

function createTestUseCase(fakes: ReturnType<typeof createFakes>) {
  return new TestOpcUaConnectionUseCase(
    fakes.resolver as never,
    fakes.unitOfWork,
    fakes.endpointPolicy,
    fakes.explorer,
  );
}

function createBrowseUseCase(fakes: ReturnType<typeof createFakes>) {
  return new BrowseOpcUaNodesUseCase(
    fakes.resolver as never,
    fakes.unitOfWork,
    fakes.endpointPolicy,
    fakes.explorer,
  );
}

describe('TestOpcUaConnectionUseCase', () => {
  it('delega en el explorador con el timeout por defecto tras comprobar el acceso (criterio 5)', async () => {
    const fakes = createFakes();

    const result = await createTestUseCase(fakes).execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      endpointUrl: ENDPOINT,
    });

    expect(result).toEqual({ reachable: true });
    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('machine-1', REQUESTER, FAKE_CTX);
    expect(fakes.explorer.testConnection).toHaveBeenCalledWith(ENDPOINT, 5000);
  });

  it('devuelve tal cual un resultado { reachable: false, reason }', async () => {
    const fakes = createFakes();
    fakes.explorer.testConnection.mockResolvedValue({ reachable: false, reason: 'TIMEOUT' });

    await expect(
      createTestUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: ENDPOINT,
      }),
    ).resolves.toEqual({ reachable: false, reason: 'TIMEOUT' });
  });

  it('no abre ninguna conexión si el host está fuera de la allowlist (criterio 4)', async () => {
    const fakes = createFakes(['10.0.0.0/8']);

    await expect(
      createTestUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: ENDPOINT,
      }),
    ).rejects.toBeInstanceOf(OpcUaEndpointNotAllowedError);
    expect(fakes.explorer.testConnection).not.toHaveBeenCalled();
  });

  it('rechaza un esquema distinto de opc.tcp:// sin abrir conexión', async () => {
    const fakes = createFakes();

    await expect(
      createTestUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: 'http://169.254.169.254/',
      }),
    ).rejects.toBeInstanceOf(InvalidOpcUaEndpointUrlError);
    expect(fakes.explorer.testConnection).not.toHaveBeenCalled();
  });

  it('no abre conexión si la Machine no es accesible para el requester', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveActive.mockRejectedValue(new MachineNotFoundError('machine-1'));

    await expect(
      createTestUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: ENDPOINT,
      }),
    ).rejects.toBeInstanceOf(MachineNotFoundError);
    expect(fakes.explorer.testConnection).not.toHaveBeenCalled();
  });
});

describe('BrowseOpcUaNodesUseCase', () => {
  it('devuelve los hijos del nodo pedido envueltos en { nodes } (criterio 6)', async () => {
    const fakes = createFakes();

    const result = await createBrowseUseCase(fakes).execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      endpointUrl: ENDPOINT,
      nodeId: 'ns=3;s="Lectura"',
    });

    expect(result).toEqual({ nodes: NODES });
    expect(fakes.explorer.browse).toHaveBeenCalledWith(ENDPOINT, 'ns=3;s="Lectura"', 5000);
  });

  it('sin nodeId delega undefined para que el explorador parta de ObjectsFolder', async () => {
    const fakes = createFakes();

    await createBrowseUseCase(fakes).execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      endpointUrl: ENDPOINT,
    });

    expect(fakes.explorer.browse).toHaveBeenCalledWith(ENDPOINT, undefined, 5000);
  });

  it('propaga OpcUaEndpointUnreachableError del explorador', async () => {
    const fakes = createFakes();
    fakes.explorer.browse.mockRejectedValue(new OpcUaEndpointUnreachableError());

    await expect(
      createBrowseUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: ENDPOINT,
      }),
    ).rejects.toBeInstanceOf(OpcUaEndpointUnreachableError);
  });

  it('no explora si el host está fuera de la allowlist (criterio 4)', async () => {
    const fakes = createFakes(['10.0.0.0/8']);

    await expect(
      createBrowseUseCase(fakes).execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        endpointUrl: ENDPOINT,
      }),
    ).rejects.toBeInstanceOf(OpcUaEndpointNotAllowedError);
    expect(fakes.explorer.browse).not.toHaveBeenCalled();
  });
});

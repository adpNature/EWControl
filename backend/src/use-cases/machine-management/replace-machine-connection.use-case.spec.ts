import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { InvalidConnectionConfigError } from './errors/invalid-connection-config.error';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { OpcUaEndpointNotAllowedError } from './errors/opc-ua-endpoint-not-allowed.error';
import { ProviderNotSupportedError } from './errors/provider-not-supported.error';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import { ReplaceMachineConnectionUseCase } from './replace-machine-connection.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ACTIVE_MACHINE = { id: 'machine-1', companyId: 'company-1', name: 'Demo', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const SIMULATOR_CONFIG = { seedProfile: 'demo', signals: [] };
const OPCUA_CONFIG = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  nodeMapping: [{ nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' }],
};

function createFakes(allowedHosts: string[] = []) {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ACTIVE_MACHINE) };
  const machineConnectionRepository = {
    create: vi.fn(),
    findByMachineId: vi.fn().mockResolvedValue({
      id: 'connection-1',
      machineId: 'machine-1',
      providerType: ProviderType.Simulator,
      connectionConfig: SIMULATOR_CONFIG,
    }),
    findByMachineIds: vi.fn(),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(
      (machineId: string, changes: { providerType: ProviderType; connectionConfig: unknown }) =>
        Promise.resolve({ id: 'connection-1', machineId, ...changes }),
    ),
    deleteByMachineId: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const eventPublisher = { publish: vi.fn() };
  const endpointPolicy = new OpcUaEndpointPolicy(allowedHosts);
  return { resolver, machineConnectionRepository, unitOfWork, eventPublisher, endpointPolicy };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new ReplaceMachineConnectionUseCase(
    fakes.resolver as never,
    fakes.machineConnectionRepository as never,
    fakes.unitOfWork,
    fakes.endpointPolicy,
    fakes.eventPublisher,
  );
}

describe('ReplaceMachineConnectionUseCase', () => {
  it('reemplaza la MachineConnection cuando providerType es Simulator', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const connection = await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      providerType: ProviderType.Simulator,
      connectionConfig: SIMULATOR_CONFIG,
    });

    expect(fakes.machineConnectionRepository.replace).toHaveBeenCalledWith(
      'machine-1',
      { providerType: ProviderType.Simulator, connectionConfig: SIMULATOR_CONFIG },
      FAKE_CTX,
    );
    expect(connection.providerType).toBe(ProviderType.Simulator);
  });

  it('acepta una config OpcUa válida, la persiste normalizada y publica MachineConnectionReplaced (spec 18, criterio 1)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      providerType: ProviderType.OpcUa,
      connectionConfig: OPCUA_CONFIG,
    });

    expect(fakes.machineConnectionRepository.replace).toHaveBeenCalledWith(
      'machine-1',
      {
        providerType: ProviderType.OpcUa,
        connectionConfig: {
          ...OPCUA_CONFIG,
          securityMode: 'None',
          securityPolicy: 'None',
          authMode: 'Anonymous',
          timeoutMs: 5000,
          samplingIntervalMs: 1000,
        },
      },
      FAKE_CTX,
    );
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('MachineConnectionReplaced', {
      machineId: 'machine-1',
      companyId: 'company-1',
      previousProviderType: ProviderType.Simulator,
      providerType: ProviderType.OpcUa,
    });
  });

  it('publica previousProviderType null si la Machine no tenía conexión', async () => {
    const fakes = createFakes();
    fakes.machineConnectionRepository.findByMachineId.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      providerType: ProviderType.Simulator,
      connectionConfig: SIMULATOR_CONFIG,
    });

    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith(
      'MachineConnectionReplaced',
      expect.objectContaining({ previousProviderType: null }),
    );
  });

  it('lanza InvalidConnectionConfigError con una config OpcUa inválida, sin tocar la conexión (criterio 3)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        providerType: ProviderType.OpcUa,
        connectionConfig: { ...OPCUA_CONFIG, securityMode: 'SignAndEncrypt' },
      }),
    ).rejects.toBeInstanceOf(InvalidConnectionConfigError);
    expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('lanza OpcUaEndpointNotAllowedError si el host está fuera de OPCUA_ALLOWED_HOSTS (criterio 4)', async () => {
    const fakes = createFakes(['10.0.0.0/8']);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        providerType: ProviderType.OpcUa,
        connectionConfig: OPCUA_CONFIG,
      }),
    ).rejects.toBeInstanceOf(OpcUaEndpointNotAllowedError);
    expect(fakes.resolver.resolveAny).not.toHaveBeenCalled();
    expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
  });

  it.each([ProviderType.Mqtt, ProviderType.ModbusTcp])(
    'lanza ProviderNotSupportedError si providerType es %s',
    async (providerType) => {
      const fakes = createFakes();
      const useCase = createUseCase(fakes);

      await expect(
        useCase.execute({
          machineId: 'machine-1',
          requester: REQUESTER,
          providerType,
          connectionConfig: SIMULATOR_CONFIG,
        }),
      ).rejects.toBeInstanceOf(ProviderNotSupportedError);
      expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
      expect(fakes.resolver.resolveAny).not.toHaveBeenCalled();
    },
  );

  it('lanza MachineInactiveError si la Machine está desactivada, sin publicar el evento', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveAny.mockResolvedValue({ ...ACTIVE_MACHINE, isActive: false });
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        providerType: ProviderType.Simulator,
        connectionConfig: SIMULATOR_CONFIG,
      }),
    ).rejects.toBeInstanceOf(MachineInactiveError);
    expect(fakes.machineConnectionRepository.replace).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

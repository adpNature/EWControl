import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../../entities/provider-type.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { BrowseOpcUaNodesUseCase } from '../../../use-cases/machine-management/browse-opc-ua-nodes.use-case';
import { InvalidConnectionConfigError } from '../../../use-cases/machine-management/errors/invalid-connection-config.error';
import { InvalidOpcUaEndpointUrlError } from '../../../use-cases/machine-management/errors/invalid-opc-ua-endpoint-url.error';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { OpcUaEndpointNotAllowedError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-not-allowed.error';
import { OpcUaEndpointUnreachableError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-unreachable.error';
import { OpcUaInvalidNodeIdError } from '../../../use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { GetMachineConnectionUseCase } from '../../../use-cases/machine-management/get-machine-connection.use-case';
import { ReplaceMachineConnectionUseCase } from '../../../use-cases/machine-management/replace-machine-connection.use-case';
import { TestOpcUaConnectionUseCase } from '../../../use-cases/machine-management/test-opc-ua-connection.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { MachineConnectionController } from './machine-connection.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('MachineConnectionController (HTTP)', () => {
  let app: INestApplication;
  let getMachineConnectionUseCase: { execute: ReturnType<typeof vi.fn> };
  let replaceMachineConnectionUseCase: { execute: ReturnType<typeof vi.fn> };
  let testOpcUaConnectionUseCase: { execute: ReturnType<typeof vi.fn> };
  let browseOpcUaNodesUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    getMachineConnectionUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'connection-1',
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: { seedProfile: 'empty', signals: [] },
      }),
    };
    replaceMachineConnectionUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'connection-1',
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: { seedProfile: 'demo', signals: [] },
      }),
    };

    testOpcUaConnectionUseCase = { execute: vi.fn().mockResolvedValue({ reachable: true }) };
    browseOpcUaNodesUseCase = { execute: vi.fn().mockResolvedValue({ nodes: [] }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [MachineConnectionController],
      providers: [
        { provide: GetMachineConnectionUseCase, useValue: getMachineConnectionUseCase },
        { provide: ReplaceMachineConnectionUseCase, useValue: replaceMachineConnectionUseCase },
        { provide: TestOpcUaConnectionUseCase, useValue: testOpcUaConnectionUseCase },
        { provide: BrowseOpcUaNodesUseCase, useValue: browseOpcUaNodesUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: unknown }, _res: unknown, next: () => void) => {
      req.user = FAKE_USER;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / devuelve la MachineConnection', async () => {
    const response = await request(app.getHttpServer()).get('/machines/machine-1/connection');

    expect(response.status).toBe(200);
    expect(response.body.providerType).toBe(ProviderType.Simulator);
  });

  it('GET / responde 404 MACHINE_NOT_FOUND si el use-case lo lanza', async () => {
    getMachineConnectionUseCase.execute.mockRejectedValue(new MachineNotFoundError('machine-1'));

    const response = await request(app.getHttpServer()).get('/machines/machine-1/connection');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('MACHINE_NOT_FOUND');
  });

  it('PUT / reemplaza la MachineConnection cuando providerType es Simulator (criterio 4)', async () => {
    const response = await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'Simulator', connectionConfig: { seedProfile: 'demo', signals: [] } });

    expect(response.status).toBe(200);
    expect(replaceMachineConnectionUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      providerType: 'Simulator',
      connectionConfig: { seedProfile: 'demo', signals: [] },
    });
  });

  it('PUT / responde 422 PROVIDER_NOT_SUPPORTED para un proveedor no soportado (spec 18, criterio 3)', async () => {
    replaceMachineConnectionUseCase.execute.mockRejectedValue(
      new ProviderNotSupportedError('Mqtt'),
    );

    const response = await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'Mqtt', connectionConfig: {} });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PROVIDER_NOT_SUPPORTED');
  });

  it('PUT / responde 400 si providerType no es un valor de ProviderType válido', async () => {
    const response = await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'NotAProvider', connectionConfig: {} });

    expect(response.status).toBe(400);
    expect(replaceMachineConnectionUseCase.execute).not.toHaveBeenCalled();
  });

  it('PUT / reenvía la config OpcUa sin transformar al use-case (spec 18)', async () => {
    const connectionConfig = {
      endpointUrl: 'opc.tcp://192.168.1.1:4840',
      nodeMapping: [{ nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' }],
    };

    await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'OpcUa', connectionConfig });

    expect(replaceMachineConnectionUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerType: 'OpcUa', connectionConfig }),
    );
  });

  it.each([
    [new InvalidConnectionConfigError('nodeMapping vacío'), 400, 'INVALID_CONNECTION_CONFIG'],
    [new InvalidOpcUaEndpointUrlError(), 400, 'INVALID_ENDPOINT_URL'],
    [new OpcUaEndpointNotAllowedError('10.0.0.1'), 422, 'OPCUA_ENDPOINT_NOT_ALLOWED'],
    [new MachineInactiveError('machine-1'), 422, 'MACHINE_INACTIVE'],
    [new Error('inesperado'), 500, 'INTERNAL_ERROR'],
  ])('PUT / traduce %s a %i %s', async (error, status, code) => {
    replaceMachineConnectionUseCase.execute.mockRejectedValue(error);

    const response = await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'OpcUa', connectionConfig: {} });

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
  });

  it('POST /opcua/test responde 200 con el resultado del use-case (criterio 5)', async () => {
    testOpcUaConnectionUseCase.execute.mockResolvedValue({ reachable: false, reason: 'TIMEOUT' });

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/connection/opcua/test')
      .send({ endpointUrl: 'opc.tcp://192.168.1.1:4840' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reachable: false, reason: 'TIMEOUT' });
    expect(testOpcUaConnectionUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      endpointUrl: 'opc.tcp://192.168.1.1:4840',
    });
  });

  it('POST /opcua/test responde 400 sin endpointUrl o con campos no declarados', async () => {
    const missing = await request(app.getHttpServer())
      .post('/machines/machine-1/connection/opcua/test')
      .send({});
    const extra = await request(app.getHttpServer())
      .post('/machines/machine-1/connection/opcua/test')
      .send({ endpointUrl: 'opc.tcp://192.168.1.1:4840', password: 'x' });

    expect(missing.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(testOpcUaConnectionUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /opcua/browse responde 200 con los nodos y reenvía nodeId (criterio 6)', async () => {
    const nodes = [
      {
        nodeId: 'ns=3;s="Lectura"',
        browseName: 'Lectura',
        displayName: 'Lectura',
        nodeClass: 'Object',
        hasChildren: true,
      },
    ];
    browseOpcUaNodesUseCase.execute.mockResolvedValue({ nodes });

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/connection/opcua/browse')
      .send({ endpointUrl: 'opc.tcp://192.168.1.1:4840', nodeId: 'ns=3;s=DataBlocksGlobal' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ nodes });
    expect(browseOpcUaNodesUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'ns=3;s=DataBlocksGlobal' }),
    );
  });

  it.each([
    [new OpcUaEndpointUnreachableError(), 502, 'OPCUA_ENDPOINT_UNREACHABLE'],
    [new OpcUaInvalidNodeIdError('ns=9;s=x'), 400, 'OPCUA_INVALID_NODE_ID'],
    [new OpcUaEndpointNotAllowedError('10.0.0.1'), 422, 'OPCUA_ENDPOINT_NOT_ALLOWED'],
    [new MachineNotFoundError('machine-1'), 404, 'MACHINE_NOT_FOUND'],
  ])('POST /opcua/browse traduce %s a %i %s', async (error, status, code) => {
    browseOpcUaNodesUseCase.execute.mockRejectedValue(error);

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/connection/opcua/browse')
      .send({ endpointUrl: 'opc.tcp://192.168.1.1:4840' });

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
  });
});

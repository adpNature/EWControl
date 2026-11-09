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
import { MachineNotOpcUaError } from '../../../use-cases/machine-management/errors/machine-not-opc-ua.error';
import { OpcUaMappingLimitError } from '../../../use-cases/machine-management/errors/opc-ua-mapping-limit.error';
import { OpcUaSyncTimeoutError } from '../../../use-cases/machine-management/errors/opc-ua-sync-timeout.error';
import { OpcUaSyncTooManyNodesError } from '../../../use-cases/machine-management/errors/opc-ua-sync-too-many-nodes.error';
import { OpcUaVariableInUseError } from '../../../use-cases/machine-management/errors/opc-ua-variable-in-use.error';
import { SaveOpcUaVariablesUseCase } from '../../../use-cases/machine-management/save-opc-ua-variables.use-case';
import { SyncOpcUaVariablesUseCase } from '../../../use-cases/machine-management/sync-opc-ua-variables.use-case';
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
  let syncOpcUaVariablesUseCase: { execute: ReturnType<typeof vi.fn> };
  let saveOpcUaVariablesUseCase: { execute: ReturnType<typeof vi.fn> };

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
    syncOpcUaVariablesUseCase = { execute: vi.fn() };
    saveOpcUaVariablesUseCase = { execute: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [MachineConnectionController],
      providers: [
        { provide: GetMachineConnectionUseCase, useValue: getMachineConnectionUseCase },
        { provide: ReplaceMachineConnectionUseCase, useValue: replaceMachineConnectionUseCase },
        { provide: TestOpcUaConnectionUseCase, useValue: testOpcUaConnectionUseCase },
        { provide: BrowseOpcUaNodesUseCase, useValue: browseOpcUaNodesUseCase },
        { provide: SyncOpcUaVariablesUseCase, useValue: syncOpcUaVariablesUseCase },
        { provide: SaveOpcUaVariablesUseCase, useValue: saveOpcUaVariablesUseCase },
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
  describe('sincronización de variables (docs/specs/21-sincronizacion-variables-opc-ua.md)', () => {
    const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

    it('POST /opcua/variables/sync responde 200 con el resultado del use-case', async () => {
      const result = { rootNodeId: ROOT, syncedAt: '2026-11-07T10:00:00.000Z', variables: [] };
      syncOpcUaVariablesUseCase.execute.mockResolvedValue(result);

      const response = await request(app.getHttpServer())
        .post('/machines/machine-1/connection/opcua/variables/sync')
        .send({ rootNodeId: ROOT });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(result);
      expect(syncOpcUaVariablesUseCase.execute).toHaveBeenCalledWith({
        machineId: 'machine-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        rootNodeId: ROOT,
      });
    });

    it.each([
      [{}],
      [{ rootNodeId: '' }],
      [{ rootNodeId: 'x'.repeat(1025) }],
      [{ rootNodeId: ROOT, endpointUrl: 'opc.tcp://otro:4840' }],
    ])('POST /opcua/variables/sync responde 400 con el body %o', async (body) => {
      const response = await request(app.getHttpServer())
        .post('/machines/machine-1/connection/opcua/variables/sync')
        .send(body);

      expect(response.status).toBe(400);
      expect(syncOpcUaVariablesUseCase.execute).not.toHaveBeenCalled();
    });

    it.each([
      [new MachineNotOpcUaError('machine-1'), 409, 'MACHINE_NOT_OPCUA'],
      [new OpcUaSyncTimeoutError(60000), 504, 'OPCUA_SYNC_TIMEOUT'],
      [new OpcUaSyncTooManyNodesError(2000), 422, 'OPCUA_SYNC_TOO_MANY_NODES'],
      [new OpcUaEndpointUnreachableError(), 502, 'OPCUA_ENDPOINT_UNREACHABLE'],
      [new OpcUaInvalidNodeIdError('x'), 400, 'OPCUA_INVALID_NODE_ID'],
      [new OpcUaEndpointNotAllowedError('10.0.0.1'), 422, 'OPCUA_ENDPOINT_NOT_ALLOWED'],
      [new MachineNotFoundError('machine-1'), 404, 'MACHINE_NOT_FOUND'],
    ])('POST /opcua/variables/sync traduce %s a %i %s', async (error, status, code) => {
      syncOpcUaVariablesUseCase.execute.mockRejectedValue(error);

      const response = await request(app.getHttpServer())
        .post('/machines/machine-1/connection/opcua/variables/sync')
        .send({ rootNodeId: ROOT });

      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
    });

    const SAVE_BODY = {
      rootNodeId: ROOT,
      variables: [
        { nodeId: `${ROOT}.x`, signalVariableName: 'GVL_HMI_x', label: 'Equis', dataType: 'Float' },
        { nodeId: `${ROOT}.y`, signalVariableName: 'GVL_HMI_y', label: null, dataType: 'Boolean' },
      ],
      remove: [`${ROOT}.z`],
    };

    it('PUT /opcua/variables responde 200 con la conexión y reenvía el body al use-case', async () => {
      const connection = { id: 'connection-1', machineId: 'machine-1', providerType: 'OpcUa' };
      saveOpcUaVariablesUseCase.execute.mockResolvedValue(connection);

      const response = await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send(SAVE_BODY);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(connection);
      expect(saveOpcUaVariablesUseCase.execute).toHaveBeenCalledWith({
        machineId: 'machine-1',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
        ...SAVE_BODY,
      });
    });

    it('PUT /opcua/variables acepta remove ausente como lista vacía', async () => {
      saveOpcUaVariablesUseCase.execute.mockResolvedValue({});

      await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send({ rootNodeId: ROOT, variables: SAVE_BODY.variables })
        .expect(200);

      expect(saveOpcUaVariablesUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ remove: [] }),
      );
    });

    it.each([
      [{ ...SAVE_BODY, variables: 'no' }],
      [{ ...SAVE_BODY, variables: [{ nodeId: 'a', signalVariableName: 'A' }] }],
      [{ ...SAVE_BODY, variables: [{ ...SAVE_BODY.variables[0], writable: true }] }],
      [{ ...SAVE_BODY, variables: [{ ...SAVE_BODY.variables[0], label: 'x'.repeat(121) }] }],
      [{ ...SAVE_BODY, remove: [42] }],
    ])('PUT /opcua/variables responde 400 con un body mal formado (%#)', async (body) => {
      const response = await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send(body);

      expect(response.status).toBe(400);
      expect(saveOpcUaVariablesUseCase.execute).not.toHaveBeenCalled();
    });

    it('PUT /opcua/variables traduce OpcUaVariableInUseError a 409 con el detalle de usos', async () => {
      const variables = [
        { signalVariableName: 'GVL_HMI_x', usedBy: [{ kind: 'Signal', id: 's-1', name: 'Equis' }] },
      ];
      saveOpcUaVariablesUseCase.execute.mockRejectedValue(
        new OpcUaVariableInUseError(variables as never),
      );

      const response = await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send(SAVE_BODY);

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('OPCUA_VARIABLE_IN_USE');
      expect(response.body.details).toEqual({ variables });
    });

    it.each([
      [new OpcUaMappingLimitError(501, 500), 422, 'OPCUA_MAPPING_LIMIT'],
      [new InvalidConnectionConfigError('x'), 400, 'INVALID_CONNECTION_CONFIG'],
      [new MachineNotOpcUaError('machine-1'), 409, 'MACHINE_NOT_OPCUA'],
    ])('PUT /opcua/variables traduce %s a %i %s', async (error, status, code) => {
      saveOpcUaVariablesUseCase.execute.mockRejectedValue(error);

      const response = await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send(SAVE_BODY);

      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
    });

    it('PUT /opcua/variables incluye resultingEntries en el 422 OPCUA_MAPPING_LIMIT', async () => {
      saveOpcUaVariablesUseCase.execute.mockRejectedValue(new OpcUaMappingLimitError(510, 500));

      const response = await request(app.getHttpServer())
        .put('/machines/machine-1/connection/opcua/variables')
        .send(SAVE_BODY);

      expect(response.body.details).toEqual({ resultingEntries: 510, maxEntries: 500 });
    });
  });
});

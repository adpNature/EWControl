import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../../entities/provider-type.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { GetMachineConnectionUseCase } from '../../../use-cases/machine-management/get-machine-connection.use-case';
import { ReplaceMachineConnectionUseCase } from '../../../use-cases/machine-management/replace-machine-connection.use-case';
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

    const moduleRef = await Test.createTestingModule({
      controllers: [MachineConnectionController],
      providers: [
        { provide: GetMachineConnectionUseCase, useValue: getMachineConnectionUseCase },
        { provide: ReplaceMachineConnectionUseCase, useValue: replaceMachineConnectionUseCase },
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

  it('PUT / responde 422 PROVIDER_NOT_SUPPORTED si providerType no es Simulator (criterio 4)', async () => {
    replaceMachineConnectionUseCase.execute.mockRejectedValue(
      new ProviderNotSupportedError('OpcUa'),
    );

    const response = await request(app.getHttpServer())
      .put('/machines/machine-1/connection')
      .send({ providerType: 'OpcUa', connectionConfig: {} });

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
});

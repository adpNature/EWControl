import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateAlarmDefinitionUseCase } from '../../../use-cases/alarms/create-alarm-definition.use-case';
import { SignalNotFoundError } from '../../../use-cases/alarms/errors/signal-not-found.error';
import { ListAlarmDefinitionsUseCase } from '../../../use-cases/alarms/list-alarm-definitions.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { AlarmDefinitionController } from './alarm-definition.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('AlarmDefinitionController (HTTP)', () => {
  let app: INestApplication;
  let createAlarmDefinitionUseCase: { execute: ReturnType<typeof vi.fn> };
  let listAlarmDefinitionsUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createAlarmDefinitionUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'def-1' }),
    };
    listAlarmDefinitionsUseCase = { execute: vi.fn().mockResolvedValue([{ id: 'def-1' }]) };

    const moduleRef = await Test.createTestingModule({
      controllers: [AlarmDefinitionController],
      providers: [
        { provide: CreateAlarmDefinitionUseCase, useValue: createAlarmDefinitionUseCase },
        { provide: ListAlarmDefinitionsUseCase, useValue: listAlarmDefinitionsUseCase },
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

  it('POST / crea una AlarmDefinition válida', async () => {
    const response = await request(app.getHttpServer())
      .post('/signals/signal-1/alarm-definitions')
      .send({
        operator: '>',
        threshold: 80,
        priority: AlarmPriority.High,
        notifyByEmail: true,
        showOnDashboard: true,
      });

    expect(response.status).toBe(201);
    expect(createAlarmDefinitionUseCase.execute).toHaveBeenCalledWith({
      signalId: 'signal-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      operator: '>',
      threshold: 80,
      priority: AlarmPriority.High,
      notifyByEmail: true,
      showOnDashboard: true,
    });
  });

  it('POST / responde 400 si operator es numérico y threshold no es un número', async () => {
    const response = await request(app.getHttpServer())
      .post('/signals/signal-1/alarm-definitions')
      .send({
        operator: '>',
        threshold: 'ochenta',
        priority: AlarmPriority.High,
        notifyByEmail: false,
        showOnDashboard: true,
      });

    expect(response.status).toBe(400);
    expect(createAlarmDefinitionUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST / acepta threshold booleano con operator ==', async () => {
    const response = await request(app.getHttpServer())
      .post('/signals/signal-1/alarm-definitions')
      .send({
        operator: '==',
        threshold: true,
        priority: AlarmPriority.Medium,
        notifyByEmail: false,
        showOnDashboard: false,
      });

    expect(response.status).toBe(201);
  });

  it('POST / responde 400 con un operator fuera de catálogo', async () => {
    const response = await request(app.getHttpServer())
      .post('/signals/signal-1/alarm-definitions')
      .send({
        operator: '<>',
        threshold: 80,
        priority: AlarmPriority.High,
        notifyByEmail: false,
        showOnDashboard: true,
      });

    expect(response.status).toBe(400);
  });

  it('POST / responde 404 SIGNAL_NOT_FOUND si el use-case lo lanza', async () => {
    createAlarmDefinitionUseCase.execute.mockRejectedValue(new SignalNotFoundError('signal-1'));

    const response = await request(app.getHttpServer())
      .post('/signals/signal-1/alarm-definitions')
      .send({
        operator: '>',
        threshold: 80,
        priority: AlarmPriority.High,
        notifyByEmail: false,
        showOnDashboard: true,
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND');
  });

  it('GET / lista las AlarmDefinition de la Signal', async () => {
    const response = await request(app.getHttpServer()).get('/signals/signal-1/alarm-definitions');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'def-1' }]);
    expect(listAlarmDefinitionsUseCase.execute).toHaveBeenCalledWith({
      signalId: 'signal-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });
});

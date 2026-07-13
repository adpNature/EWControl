import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmStateType } from '../../../entities/alarm-state-type.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { AlarmStateNotFoundError } from '../../../use-cases/alarms/errors/alarm-state-not-found.error';
import { GetAlarmStateUseCase } from '../../../use-cases/alarms/get-alarm-state.use-case';
import { ListAlarmStatesUseCase } from '../../../use-cases/alarms/list-alarm-states.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { AlarmStateController } from './alarm-state.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('AlarmStateController (HTTP)', () => {
  let app: INestApplication;
  let listAlarmStatesUseCase: { execute: ReturnType<typeof vi.fn> };
  let getAlarmStateUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    listAlarmStatesUseCase = {
      execute: vi
        .fn()
        .mockResolvedValue({ data: [{ id: 'state-1' }], total: 1, limit: 20, offset: 0 }),
    };
    getAlarmStateUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'state-1', history: [{ id: 'state-1' }] }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AlarmStateController],
      providers: [
        { provide: ListAlarmStatesUseCase, useValue: listAlarmStatesUseCase },
        { provide: GetAlarmStateUseCase, useValue: getAlarmStateUseCase },
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

  it('GET / lista con los filtros por defecto', async () => {
    const response = await request(app.getHttpServer()).get('/alarm-states');

    expect(response.status).toBe(200);
    expect(listAlarmStatesUseCase.execute).toHaveBeenCalledWith({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      filter: { status: undefined, machineId: undefined, priority: undefined },
      pagination: { limit: 20, offset: 0 },
    });
  });

  it('GET / filtra por status/machineId/priority', async () => {
    const response = await request(app.getHttpServer()).get(
      '/alarm-states?status=ACTIVE&machineId=550e8400-e29b-41d4-a716-446655440000&priority=HIGH',
    );

    expect(response.status).toBe(200);
    expect(listAlarmStatesUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          status: AlarmStateType.Active,
          machineId: '550e8400-e29b-41d4-a716-446655440000',
          priority: 'HIGH',
        },
      }),
    );
  });

  it('GET / responde 400 con un status fuera de catálogo', async () => {
    const response = await request(app.getHttpServer()).get('/alarm-states?status=UNKNOWN');

    expect(response.status).toBe(400);
    expect(listAlarmStatesUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /:id devuelve el detalle con histórico', async () => {
    const response = await request(app.getHttpServer()).get('/alarm-states/state-1');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'state-1', history: [{ id: 'state-1' }] });
  });

  it('GET /:id responde 404 ALARM_STATE_NOT_FOUND si el use-case lo lanza', async () => {
    getAlarmStateUseCase.execute.mockRejectedValue(new AlarmStateNotFoundError('state-1'));

    const response = await request(app.getHttpServer()).get('/alarm-states/state-1');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ALARM_STATE_NOT_FOUND');
  });
});

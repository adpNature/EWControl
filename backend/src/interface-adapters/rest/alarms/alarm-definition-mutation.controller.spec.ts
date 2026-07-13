import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { DeactivateAlarmDefinitionUseCase } from '../../../use-cases/alarms/deactivate-alarm-definition.use-case';
import { AlarmDefinitionNotFoundError } from '../../../use-cases/alarms/errors/alarm-definition-not-found.error';
import { UpdateAlarmDefinitionUseCase } from '../../../use-cases/alarms/update-alarm-definition.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { AlarmDefinitionMutationController } from './alarm-definition-mutation.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('AlarmDefinitionMutationController (HTTP)', () => {
  let app: INestApplication;
  let updateAlarmDefinitionUseCase: { execute: ReturnType<typeof vi.fn> };
  let deactivateAlarmDefinitionUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    updateAlarmDefinitionUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'def-1', priority: AlarmPriority.Critical }),
    };
    deactivateAlarmDefinitionUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [AlarmDefinitionMutationController],
      providers: [
        { provide: UpdateAlarmDefinitionUseCase, useValue: updateAlarmDefinitionUseCase },
        { provide: DeactivateAlarmDefinitionUseCase, useValue: deactivateAlarmDefinitionUseCase },
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

  it('PATCH /:id actualiza la prioridad', async () => {
    const response = await request(app.getHttpServer())
      .patch('/alarm-definitions/def-1')
      .send({ priority: AlarmPriority.Critical });

    expect(response.status).toBe(200);
    expect(updateAlarmDefinitionUseCase.execute).toHaveBeenCalledWith({
      alarmDefinitionId: 'def-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      changes: { priority: AlarmPriority.Critical },
    });
  });

  it('PATCH /:id responde 400 si threshold no es numérico con operator numérico', async () => {
    const response = await request(app.getHttpServer())
      .patch('/alarm-definitions/def-1')
      .send({ operator: '>', threshold: 'ochenta' });

    expect(response.status).toBe(400);
    expect(updateAlarmDefinitionUseCase.execute).not.toHaveBeenCalled();
  });

  it('PATCH /:id responde 404 ALARM_DEFINITION_NOT_FOUND si el use-case lo lanza', async () => {
    updateAlarmDefinitionUseCase.execute.mockRejectedValue(
      new AlarmDefinitionNotFoundError('def-1'),
    );

    const response = await request(app.getHttpServer())
      .patch('/alarm-definitions/def-1')
      .send({ priority: AlarmPriority.Low });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ALARM_DEFINITION_NOT_FOUND');
  });

  it('DELETE /:id responde 204 en el caso feliz', async () => {
    const response = await request(app.getHttpServer()).delete('/alarm-definitions/def-1');

    expect(response.status).toBe(204);
    expect(deactivateAlarmDefinitionUseCase.execute).toHaveBeenCalledWith({
      alarmDefinitionId: 'def-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('DELETE /:id responde 404 ALARM_DEFINITION_NOT_FOUND si el use-case lo lanza', async () => {
    deactivateAlarmDefinitionUseCase.execute.mockRejectedValue(
      new AlarmDefinitionNotFoundError('def-1'),
    );

    const response = await request(app.getHttpServer()).delete('/alarm-definitions/def-1');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ALARM_DEFINITION_NOT_FOUND');
  });
});

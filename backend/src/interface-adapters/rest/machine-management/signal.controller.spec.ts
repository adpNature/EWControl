import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalType } from '../../../entities/signal-type.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateSignalUseCase } from '../../../use-cases/machine-management/create-signal.use-case';
import { DeleteSignalUseCase } from '../../../use-cases/machine-management/delete-signal.use-case';
import { FormulaReferencesUnknownVariableError } from '../../../use-cases/machine-management/errors/formula-references-unknown-variable.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { SignalNotFoundError } from '../../../use-cases/machine-management/errors/signal-not-found.error';
import { GetSignalUseCase } from '../../../use-cases/machine-management/get-signal.use-case';
import { ListSignalsUseCase } from '../../../use-cases/machine-management/list-signals.use-case';
import { UpdateSignalUseCase } from '../../../use-cases/machine-management/update-signal.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { SignalController } from './signal.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('SignalController (HTTP)', () => {
  let app: INestApplication;
  let createSignalUseCase: { execute: ReturnType<typeof vi.fn> };
  let listSignalsUseCase: { execute: ReturnType<typeof vi.fn> };
  let getSignalUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateSignalUseCase: { execute: ReturnType<typeof vi.fn> };
  let deleteSignalUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createSignalUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'signal-1', machineId: 'machine-1' }),
    };
    listSignalsUseCase = {
      execute: vi.fn().mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 }),
    };
    getSignalUseCase = { execute: vi.fn().mockResolvedValue({ id: 'signal-1' }) };
    updateSignalUseCase = { execute: vi.fn().mockResolvedValue({ id: 'signal-1', name: 'New' }) };
    deleteSignalUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [SignalController],
      providers: [
        { provide: CreateSignalUseCase, useValue: createSignalUseCase },
        { provide: ListSignalsUseCase, useValue: listSignalsUseCase },
        { provide: GetSignalUseCase, useValue: getSignalUseCase },
        { provide: UpdateSignalUseCase, useValue: updateSignalUseCase },
        { provide: DeleteSignalUseCase, useValue: deleteSignalUseCase },
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

  it('POST / crea una Signal DIRECT (criterio 5)', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Temperatura',
        signalType: 'DIRECT',
        signalSource: { variableName: 'temperature' },
        unit: '°C',
      });

    expect(response.status).toBe(201);
    expect(createSignalUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      name: 'Temperatura',
      signalType: SignalType.DIRECT,
      signalSource: { variableName: 'temperature' },
      unit: '°C',
    });
  });

  it('POST / crea una Signal FORMULA validando el DTO anidado según signalType', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Diferencial',
        signalType: 'FORMULA',
        signalSource: { expression: 'a - b', variables: ['a', 'b'] },
        unit: 'u',
      });

    expect(response.status).toBe(201);
    expect(createSignalUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        signalType: SignalType.FORMULA,
        signalSource: { expression: 'a - b', variables: ['a', 'b'] },
      }),
    );
  });

  it('POST / responde 400 si signalSource no encaja con la forma de signalType', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Diferencial',
        signalType: 'FORMULA',
        signalSource: { variableName: 'temperature' },
        unit: 'u',
      });

    expect(response.status).toBe(400);
    expect(createSignalUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST / responde 422 FORMULA_REFERENCES_UNKNOWN_VARIABLE si el use-case lo lanza (criterio 5)', async () => {
    createSignalUseCase.execute.mockRejectedValue(
      new FormulaReferencesUnknownVariableError(['unknownVar']),
    );

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Diferencial',
        signalType: 'FORMULA',
        signalSource: { expression: 'unknownVar', variables: ['unknownVar'] },
        unit: 'u',
      });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('FORMULA_REFERENCES_UNKNOWN_VARIABLE');
    expect(response.body.details).toEqual({ variables: ['unknownVar'] });
  });

  it('POST / responde 400 si el body incluye machineId (Mass Assignment, criterio 7)', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Temperatura',
        signalType: 'DIRECT',
        signalSource: { variableName: 'temperature' },
        unit: '°C',
        machineId: 'other-machine',
      });

    expect(response.status).toBe(400);
    expect(createSignalUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /:id responde 404 SIGNAL_NOT_FOUND si el use-case lo lanza', async () => {
    getSignalUseCase.execute.mockRejectedValue(new SignalNotFoundError('missing', 'machine-1'));

    const response = await request(app.getHttpServer()).get('/machines/machine-1/signals/missing');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND');
  });

  it('GET /:id responde 404 MACHINE_NOT_FOUND si la Machine no existe', async () => {
    getSignalUseCase.execute.mockRejectedValue(new MachineNotFoundError('machine-1'));

    const response = await request(app.getHttpServer()).get('/machines/machine-1/signals/signal-1');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('MACHINE_NOT_FOUND');
  });

  it('DELETE /:id responde 204 en el caso feliz', async () => {
    const response = await request(app.getHttpServer()).delete(
      '/machines/machine-1/signals/signal-1',
    );

    expect(response.status).toBe(204);
    expect(deleteSignalUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('PATCH /:id responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    updateSignalUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer())
      .patch('/machines/machine-1/signals/signal-1')
      .send({ name: 'x' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});

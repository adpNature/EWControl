import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../../entities/signal-quality.enum';
import { SignalType } from '../../../entities/signal-type.enum';
import { UserRole } from '../../../entities/user-role.enum';
import { SignalValueNotAvailableError } from '../../../use-cases/dashboard/errors/signal-value-not-available.error';
import { InvalidHistoryRangeError } from '../../../use-cases/history/errors/invalid-history-range.error';
import { GetSignalHistoryUseCase } from '../../../use-cases/history/get-signal-history.use-case';
import { CreateSignalUseCase } from '../../../use-cases/machine-management/create-signal.use-case';
import { DeleteSignalUseCase } from '../../../use-cases/machine-management/delete-signal.use-case';
import { FormulaExpressionInvalidError } from '../../../use-cases/machine-management/errors/formula-expression-invalid.error';
import { FormulaReferencesUnknownVariableError } from '../../../use-cases/machine-management/errors/formula-references-unknown-variable.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { SignalNotFoundError } from '../../../use-cases/machine-management/errors/signal-not-found.error';
import { GetSignalUseCase } from '../../../use-cases/machine-management/get-signal.use-case';
import { GetSignalValueUseCase } from '../../../use-cases/machine-management/get-signal-value.use-case';
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
  let getSignalValueUseCase: { execute: ReturnType<typeof vi.fn> };
  let getSignalHistoryUseCase: { execute: ReturnType<typeof vi.fn> };

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
    getSignalValueUseCase = {
      execute: vi.fn().mockResolvedValue({
        signalId: 'signal-1',
        machineId: 'machine-1',
        companyId: 'company-1',
        value: 24.8,
        quality: SignalQuality.Good,
        timestamp: new Date('2026-07-12T10:00:00Z'),
        updatedAt: new Date('2026-07-12T10:00:00Z'),
      }),
    };
    getSignalHistoryUseCase = {
      execute: vi.fn().mockResolvedValue({
        signalId: 'signal-1',
        resolution: 'raw',
        points: [{ timestamp: new Date('2026-07-12T09:30:00Z'), value: 24.8 }],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SignalController],
      providers: [
        { provide: CreateSignalUseCase, useValue: createSignalUseCase },
        { provide: ListSignalsUseCase, useValue: listSignalsUseCase },
        { provide: GetSignalUseCase, useValue: getSignalUseCase },
        { provide: UpdateSignalUseCase, useValue: updateSignalUseCase },
        { provide: DeleteSignalUseCase, useValue: deleteSignalUseCase },
        { provide: GetSignalValueUseCase, useValue: getSignalValueUseCase },
        { provide: GetSignalHistoryUseCase, useValue: getSignalHistoryUseCase },
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

  it('POST / responde 422 FORMULA_EXPRESSION_INVALID si el use-case lo lanza (spec 13, criterio 9)', async () => {
    createSignalUseCase.execute.mockRejectedValue(
      new FormulaExpressionInvalidError('paréntesis desbalanceados'),
    );

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/signals')
      .send({
        name: 'Diferencial',
        signalType: 'FORMULA',
        signalSource: { expression: '(a - b', variables: ['a', 'b'] },
        unit: 'u',
      });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('FORMULA_EXPRESSION_INVALID');
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

  it('GET /:id/value responde 200 con la entrada de la Realtime Cache (docs/specs/07, criterio 2)', async () => {
    const response = await request(app.getHttpServer()).get(
      '/machines/machine-1/signals/signal-1/value',
    );

    expect(response.status).toBe(200);
    expect(response.body.value).toBe(24.8);
    expect(getSignalValueUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      signalId: 'signal-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('GET /:id/value responde 404 SIGNAL_VALUE_NOT_AVAILABLE si no hay entrada en la Realtime Cache', async () => {
    getSignalValueUseCase.execute.mockRejectedValue(new SignalValueNotAvailableError('signal-1'));

    const response = await request(app.getHttpServer()).get(
      '/machines/machine-1/signals/signal-1/value',
    );

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SIGNAL_VALUE_NOT_AVAILABLE');
  });

  it('GET /:id/history responde 200 con los puntos del use-case, sin enviar resolution', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: '2026-07-12T09:00:00Z', to: '2026-07-12T10:00:00Z' });

    expect(response.status).toBe(200);
    expect(response.body.points).toHaveLength(1);
    expect(getSignalHistoryUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      signalId: 'signal-1',
      from: new Date('2026-07-12T09:00:00Z'),
      to: new Date('2026-07-12T10:00:00Z'),
      resolution: undefined,
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('GET /:id/history responde 200 respetando resolution cuando se indica explícitamente', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: '2026-07-12T09:00:00Z', to: '2026-07-12T10:00:00Z', resolution: 'hour' });

    expect(response.status).toBe(200);
    expect(getSignalHistoryUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ resolution: 'hour' }),
    );
  });

  it('GET /:id/history responde 400 si from/to no son ISO 8601', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: 'not-a-date', to: '2026-07-12T10:00:00Z' });

    expect(response.status).toBe(400);
    expect(getSignalHistoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /:id/history responde 400 si resolution no es una de las soportadas', async () => {
    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: '2026-07-12T09:00:00Z', to: '2026-07-12T10:00:00Z', resolution: 'week' });

    expect(response.status).toBe(400);
    expect(getSignalHistoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /:id/history responde 400 INVALID_RANGE si el use-case lo lanza', async () => {
    getSignalHistoryUseCase.execute.mockRejectedValue(
      new InvalidHistoryRangeError(
        new Date('2026-07-12T10:00:00Z'),
        new Date('2026-07-12T09:00:00Z'),
      ),
    );

    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: '2026-07-12T10:00:00Z', to: '2026-07-12T09:00:00Z' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_RANGE');
  });

  it('GET /:id/history responde 404 SIGNAL_NOT_FOUND si el use-case lo lanza', async () => {
    getSignalHistoryUseCase.execute.mockRejectedValue(
      new SignalNotFoundError('signal-1', 'machine-1'),
    );

    const response = await request(app.getHttpServer())
      .get('/machines/machine-1/signals/signal-1/history')
      .query({ from: '2026-07-12T09:00:00Z', to: '2026-07-12T10:00:00Z' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND');
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

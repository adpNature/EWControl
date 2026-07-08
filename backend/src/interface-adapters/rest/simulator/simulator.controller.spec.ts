import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MachineNotFoundError } from '../../../use-cases/simulator-control/errors/machine-not-found.error';
import { NotASimulatedMachineError } from '../../../use-cases/simulator-control/errors/not-a-simulated-machine.error';
import { SignalNotFoundError } from '../../../use-cases/simulator-control/errors/signal-not-found.error';
import { ForceDisconnectSimulatorUseCase } from '../../../use-cases/simulator-control/force-disconnect-simulator.use-case';
import { ForceSignalQualityUseCase } from '../../../use-cases/simulator-control/force-signal-quality.use-case';
import { ReconnectSimulatorUseCase } from '../../../use-cases/simulator-control/reconnect-simulator.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { SimulatorController } from './simulator.controller';

describe('SimulatorController (HTTP)', () => {
  let app: INestApplication;
  let forceDisconnectUseCase: { execute: ReturnType<typeof vi.fn> };
  let reconnectUseCase: { execute: ReturnType<typeof vi.fn> };
  let forceSignalQualityUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    forceDisconnectUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    reconnectUseCase = { execute: vi.fn().mockResolvedValue(undefined) };
    forceSignalQualityUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [SimulatorController],
      providers: [
        { provide: ForceDisconnectSimulatorUseCase, useValue: forceDisconnectUseCase },
        { provide: ReconnectSimulatorUseCase, useValue: reconnectUseCase },
        { provide: ForceSignalQualityUseCase, useValue: forceSignalQualityUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST force-disconnect responde 200 en el caso feliz', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-disconnect')
      .send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ machineId: 'machine-1' });
    expect(forceDisconnectUseCase.execute).toHaveBeenCalledWith('machine-1');
  });

  it('POST force-disconnect responde 422 NOT_A_SIMULATED_MACHINE si el use-case lo lanza', async () => {
    forceDisconnectUseCase.execute.mockRejectedValue(new NotASimulatedMachineError('machine-1'));

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-disconnect')
      .send();

    expect(response.status).toBe(422);
    expect(response.body).toEqual(expect.objectContaining({ code: 'NOT_A_SIMULATED_MACHINE' }));
  });

  it('POST reconnect responde 200 en el caso feliz', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/reconnect')
      .send();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ machineId: 'machine-1' });
    expect(reconnectUseCase.execute).toHaveBeenCalledWith('machine-1');
  });

  it('POST reconnect responde 404 MACHINE_NOT_FOUND si el use-case lo lanza', async () => {
    reconnectUseCase.execute.mockRejectedValue(new MachineNotFoundError('machine-1'));

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/reconnect')
      .send();

    expect(response.status).toBe(404);
    expect(response.body).toEqual(expect.objectContaining({ code: 'MACHINE_NOT_FOUND' }));
  });

  it('POST force-disconnect responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    forceDisconnectUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-disconnect')
      .send();

    expect(response.status).toBe(500);
    expect(response.body).toEqual(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
  });

  it('POST force-quality responde 400 con body inválido', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-quality')
      .send({ signalId: 'not-a-uuid', quality: 'FOO', durationTicks: 0 });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('BAD_REQUEST');
    expect(forceSignalQualityUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST force-quality responde 404 SIGNAL_NOT_FOUND si el use-case lo lanza', async () => {
    forceSignalQualityUseCase.execute.mockRejectedValue(
      new SignalNotFoundError('11111111-1111-4111-8111-111111111111', 'machine-1'),
    );

    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-quality')
      .send({
        signalId: '11111111-1111-4111-8111-111111111111',
        quality: 'BAD',
        durationTicks: 10,
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND');
  });

  it('POST force-quality responde 200 en el caso feliz y reenvía el body validado', async () => {
    const response = await request(app.getHttpServer())
      .post('/machines/machine-1/simulator/force-quality')
      .send({
        signalId: '11111111-1111-4111-8111-111111111111',
        quality: 'BAD',
        durationTicks: 10,
      });

    expect(response.status).toBe(200);
    expect(forceSignalQualityUseCase.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      signalId: '11111111-1111-4111-8111-111111111111',
      quality: 'BAD',
      durationTicks: 10,
    });
  });
});

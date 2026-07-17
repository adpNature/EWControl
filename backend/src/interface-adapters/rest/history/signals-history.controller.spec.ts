import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { CompanyIdRequiredError } from '../../../use-cases/history/errors/company-id-required.error';
import { InvalidHistoryRangeError } from '../../../use-cases/history/errors/invalid-history-range.error';
import { SignalNotFoundForHistoryError } from '../../../use-cases/history/errors/signal-not-found-for-history.error';
import { GetSignalsHistoryUseCase } from '../../../use-cases/history/get-signals-history.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { SignalsHistoryController } from './signals-history.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

const SIGNAL_ID_A = '045e6fee-e15e-4d20-80c7-caa3da150491';
const SIGNAL_ID_B = 'cca78c79-a654-4432-8227-2cb555e63023';

describe('SignalsHistoryController (HTTP)', () => {
  let app: INestApplication;
  let getSignalsHistoryUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    getSignalsHistoryUseCase = {
      execute: vi.fn().mockResolvedValue({
        resolution: 'raw',
        series: [{ signalId: SIGNAL_ID_A, machineId: 'machine-1', points: [] }],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [SignalsHistoryController],
      providers: [{ provide: GetSignalsHistoryUseCase, useValue: getSignalsHistoryUseCase }],
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

  it('GET /history responde 200 y parsea signalIds coma-separado', async () => {
    const response = await request(app.getHttpServer())
      .get('/signals/history')
      .query({
        signalIds: `${SIGNAL_ID_A},${SIGNAL_ID_B}`,
        from: '2026-07-12T09:00:00Z',
        to: '2026-07-12T10:00:00Z',
      });

    expect(response.status).toBe(200);
    expect(getSignalsHistoryUseCase.execute).toHaveBeenCalledWith({
      signalIds: [SIGNAL_ID_A, SIGNAL_ID_B],
      from: new Date('2026-07-12T09:00:00Z'),
      to: new Date('2026-07-12T10:00:00Z'),
      resolution: undefined,
      companyId: undefined,
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });

  it('GET /history responde 400 si hay más de 8 signalIds', async () => {
    const nineIds = [
      '045e6fee-e15e-4d20-80c7-caa3da150491',
      'cca78c79-a654-4432-8227-2cb555e63023',
      'b4ec6402-2d91-441e-a1af-2d179056f066',
      'd5047e8b-5396-442a-8675-5ce229141a1a',
      '4576ae32-6cfb-40f6-9605-b18d8a08299d',
      '347c1d2b-c3ae-46b1-a888-39a71308f19a',
      '938a401b-cac3-4032-9f45-6dcf120c4454',
      '17e70ab1-b7ec-4992-9f02-16c9586195fb',
      'de795db4-93de-4058-9fe2-c774accb157a',
    ];

    const response = await request(app.getHttpServer())
      .get('/signals/history')
      .query({
        signalIds: nineIds.join(','),
        from: '2026-07-12T09:00:00Z',
        to: '2026-07-12T10:00:00Z',
      });

    expect(response.status).toBe(400);
    expect(getSignalsHistoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /history responde 400 si algún signalId no es un UUID', async () => {
    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: 'not-a-uuid',
      from: '2026-07-12T09:00:00Z',
      to: '2026-07-12T10:00:00Z',
    });

    expect(response.status).toBe(400);
    expect(getSignalsHistoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('GET /history responde 400 INVALID_RANGE si el use-case lo lanza', async () => {
    getSignalsHistoryUseCase.execute.mockRejectedValue(
      new InvalidHistoryRangeError(
        new Date('2026-07-12T10:00:00Z'),
        new Date('2026-07-12T09:00:00Z'),
      ),
    );

    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: SIGNAL_ID_A,
      from: '2026-07-12T10:00:00Z',
      to: '2026-07-12T09:00:00Z',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_RANGE');
  });

  it('GET /history responde 400 COMPANY_ID_REQUIRED si el use-case lo lanza', async () => {
    getSignalsHistoryUseCase.execute.mockRejectedValue(new CompanyIdRequiredError());

    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: SIGNAL_ID_A,
      from: '2026-07-12T09:00:00Z',
      to: '2026-07-12T10:00:00Z',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('COMPANY_ID_REQUIRED');
  });

  it('GET /history responde 422 SIGNAL_NOT_FOUND_FOR_HISTORY si el use-case lo lanza', async () => {
    getSignalsHistoryUseCase.execute.mockRejectedValue(
      new SignalNotFoundForHistoryError([SIGNAL_ID_A]),
    );

    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: SIGNAL_ID_A,
      from: '2026-07-12T09:00:00Z',
      to: '2026-07-12T10:00:00Z',
    });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND_FOR_HISTORY');
    expect(response.body.details).toEqual({ signalIds: [SIGNAL_ID_A] });
  });

  it('GET /history responde 200 pasando companyId cuando se indica explícitamente', async () => {
    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: SIGNAL_ID_A,
      from: '2026-07-12T09:00:00Z',
      to: '2026-07-12T10:00:00Z',
      companyId: 'b4ec6402-2d91-441e-a1af-2d179056f066',
    });

    expect(response.status).toBe(200);
    expect(getSignalsHistoryUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'b4ec6402-2d91-441e-a1af-2d179056f066' }),
    );
  });

  it('GET /history responde 500 INTERNAL_ERROR ante un error no mapeado', async () => {
    getSignalsHistoryUseCase.execute.mockRejectedValue(new Error('boom'));

    const response = await request(app.getHttpServer()).get('/signals/history').query({
      signalIds: SIGNAL_ID_A,
      from: '2026-07-12T09:00:00Z',
      to: '2026-07-12T10:00:00Z',
    });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });
});

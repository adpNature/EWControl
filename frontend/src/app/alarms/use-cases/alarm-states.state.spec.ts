import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AlarmStatesApiService } from '../adapters/alarm-states-api.service';
import { AlarmState } from '../entities/alarm-state.model';
import { AlarmStatesState } from './alarm-states.state';

const ALARM_STATE_1: AlarmState = {
  id: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  status: 'ACTIVE',
  priority: 'HIGH',
  activatedAt: '2026-07-13T10:00:00Z',
  resolvedAt: null,
  ackedAt: null,
  ackedByUserId: null,
  ackedByEmail: null,
};

describe('AlarmStatesState', () => {
  let service: AlarmStatesState;
  let alarmStatesApi: { list: ReturnType<typeof vi.fn>; ack: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    alarmStatesApi = { list: vi.fn(), ack: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: AlarmStatesApiService, useValue: alarmStatesApi }],
    });
    service = TestBed.inject(AlarmStatesState);
  });

  it('load(filters) sincroniza el signal alarmStates con la respuesta', async () => {
    alarmStatesApi.list.mockReturnValue(
      of({ data: [ALARM_STATE_1], total: 1, limit: 20, offset: 0 }),
    );

    await new Promise((resolve, reject) =>
      service.load({ status: 'ACTIVE' }).subscribe({ next: resolve, error: reject }),
    );

    expect(alarmStatesApi.list).toHaveBeenCalledWith(
      { status: 'ACTIVE' },
      { limit: 20, offset: 0 },
    );
    expect(service.alarmStates()).toEqual([ALARM_STATE_1]);
  });

  it('load() en fallo apaga loading sin romper', async () => {
    alarmStatesApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.load({}).subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('applyTriggered() añade la alarma activada al principio de la lista', () => {
    service.applyTriggered({
      alarmStateId: 'state-2',
      alarmDefinitionId: 'def-2',
      signalId: 'signal-2',
      priority: 'CRITICAL',
      timestamp: '2026-07-13T11:00:00Z',
    });

    expect(service.alarmStates()).toEqual([
      {
        id: 'state-2',
        alarmDefinitionId: 'def-2',
        signalId: 'signal-2',
        status: 'ACTIVE',
        priority: 'CRITICAL',
        activatedAt: '2026-07-13T11:00:00Z',
        resolvedAt: null,
        ackedAt: null,
        ackedByUserId: null,
        ackedByEmail: null,
      },
    ]);
  });

  it('applyCleared() marca INACTIVE la alarma ya presente en la lista, sin retirarla', async () => {
    alarmStatesApi.list.mockReturnValue(
      of({ data: [ALARM_STATE_1], total: 1, limit: 20, offset: 0 }),
    );
    await new Promise((resolve, reject) =>
      service.load({}).subscribe({ next: resolve, error: reject }),
    );

    service.applyCleared({
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      timestamp: '2026-07-13T12:00:00Z',
    });

    expect(service.alarmStates()).toEqual([
      { ...ALARM_STATE_1, status: 'INACTIVE', resolvedAt: '2026-07-13T12:00:00Z' },
    ]);
  });

  it('ack(id) actualiza en el signal la alarma reconocida por la API', async () => {
    alarmStatesApi.list.mockReturnValue(
      of({ data: [ALARM_STATE_1], total: 1, limit: 20, offset: 0 }),
    );
    await new Promise((resolve, reject) =>
      service.load({}).subscribe({ next: resolve, error: reject }),
    );
    const acked: AlarmState = {
      ...ALARM_STATE_1,
      ackedAt: '2026-07-13T13:00:00Z',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
    };
    alarmStatesApi.ack.mockReturnValue(of(acked));

    await new Promise((resolve, reject) =>
      service.ack('state-1').subscribe({ next: resolve, error: reject }),
    );

    expect(alarmStatesApi.ack).toHaveBeenCalledWith('state-1');
    expect(service.alarmStates()).toEqual([acked]);
  });

  it('applyAcked() aplica el evento de WebSocket sobre la alarma ya presente en la lista', async () => {
    alarmStatesApi.list.mockReturnValue(
      of({ data: [ALARM_STATE_1], total: 1, limit: 20, offset: 0 }),
    );
    await new Promise((resolve, reject) =>
      service.load({}).subscribe({ next: resolve, error: reject }),
    );

    service.applyAcked({
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
      ackedAt: '2026-07-13T13:00:00Z',
    });

    expect(service.alarmStates()).toEqual([
      {
        ...ALARM_STATE_1,
        ackedAt: '2026-07-13T13:00:00Z',
        ackedByUserId: 'user-1',
        ackedByEmail: 'admin@ewcontrol.local',
      },
    ]);
  });
});

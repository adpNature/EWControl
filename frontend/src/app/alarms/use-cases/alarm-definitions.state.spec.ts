import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AlarmDefinitionsApiService } from '../adapters/alarm-definitions-api.service';
import { AlarmDefinition } from '../entities/alarm-definition.model';
import { AlarmDefinitionsState } from './alarm-definitions.state';

const DEFINITION_1: AlarmDefinition = {
  id: 'def-1',
  signalId: 'signal-1',
  operator: '>',
  threshold: 80,
  priority: 'HIGH',
  notifyByEmail: true,
  showOnDashboard: true,
  isActive: true,
};

describe('AlarmDefinitionsState', () => {
  let service: AlarmDefinitionsState;
  let alarmDefinitionsApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deactivate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    alarmDefinitionsApi = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deactivate: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AlarmDefinitionsApiService, useValue: alarmDefinitionsApi }],
    });
    service = TestBed.inject(AlarmDefinitionsState);
  });

  it('load(signalId) sincroniza el signal definitions con la respuesta de esa Signal', async () => {
    alarmDefinitionsApi.list.mockReturnValue(of([DEFINITION_1]));

    await new Promise((resolve, reject) =>
      service.load('signal-1').subscribe({ next: resolve, error: reject }),
    );

    expect(alarmDefinitionsApi.list).toHaveBeenCalledWith('signal-1');
    expect(service.definitions()).toEqual([DEFINITION_1]);
  });

  it('load() en fallo apaga loading sin romper', async () => {
    alarmDefinitionsApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.load('signal-1').subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('create() añade la AlarmDefinition creada al signal', async () => {
    alarmDefinitionsApi.create.mockReturnValue(of(DEFINITION_1));

    await new Promise((resolve, reject) =>
      service
        .create('signal-1', {
          operator: '>',
          threshold: 80,
          priority: 'HIGH',
          notifyByEmail: true,
          showOnDashboard: true,
        })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.definitions()).toEqual([DEFINITION_1]);
  });

  it('update() reemplaza la AlarmDefinition editada en el signal', async () => {
    alarmDefinitionsApi.list.mockReturnValue(of([DEFINITION_1]));
    await new Promise((resolve, reject) =>
      service.load('signal-1').subscribe({ next: resolve, error: reject }),
    );
    const updated = { ...DEFINITION_1, priority: 'CRITICAL' as const };
    alarmDefinitionsApi.update.mockReturnValue(of(updated));

    await new Promise((resolve, reject) =>
      service.update('def-1', { priority: 'CRITICAL' }).subscribe({ next: resolve, error: reject }),
    );

    expect(service.definitions()).toEqual([updated]);
  });

  it('deactivate() marca isActive en false sin retirar la fila (preserva histórico visible)', async () => {
    alarmDefinitionsApi.list.mockReturnValue(of([DEFINITION_1]));
    await new Promise((resolve, reject) =>
      service.load('signal-1').subscribe({ next: resolve, error: reject }),
    );
    alarmDefinitionsApi.deactivate.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.deactivate('def-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.definitions()).toEqual([{ ...DEFINITION_1, isActive: false }]);
  });
});

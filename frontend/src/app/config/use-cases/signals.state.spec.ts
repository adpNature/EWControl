import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SignalsApiService } from '../adapters/signals-api.service';
import { Signal } from '../entities/signal.model';
import { SignalsState } from './signals.state';

const SIGNAL_1: Signal = {
  id: 'signal-1',
  machineId: 'machine-1',
  name: 'Temperatura',
  signalType: 'DIRECT',
  signalSource: { variableName: 'temperature' },
  unit: '°C',
  historyEnabled: false,
};

describe('SignalsState', () => {
  let service: SignalsState;
  let signalsApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    signalsApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: SignalsApiService, useValue: signalsApi }],
    });
    service = TestBed.inject(SignalsState);
  });

  it('load(machineId) sincroniza el signal signals con la respuesta de esa Machine', async () => {
    signalsApi.list.mockReturnValue(of({ data: [SIGNAL_1], total: 1, limit: 20, offset: 0 }));

    await new Promise((resolve, reject) =>
      service.load('machine-1').subscribe({ next: resolve, error: reject }),
    );

    expect(signalsApi.list).toHaveBeenCalledWith('machine-1', { limit: 20, offset: 0 });
    expect(service.signals()).toEqual([SIGNAL_1]);
  });

  it('load() en fallo apaga loading sin romper', async () => {
    signalsApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.load('machine-1').subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('create() añade la Signal creada al signal', async () => {
    signalsApi.create.mockReturnValue(of(SIGNAL_1));

    await new Promise((resolve, reject) =>
      service
        .create('machine-1', {
          name: 'Temperatura',
          signalType: 'DIRECT',
          signalSource: { variableName: 'temperature' },
          unit: '°C',
        })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.signals()).toEqual([SIGNAL_1]);
  });

  it('remove() retira la Signal del signal', async () => {
    signalsApi.list.mockReturnValue(of({ data: [SIGNAL_1], total: 1, limit: 20, offset: 0 }));
    await new Promise((resolve, reject) =>
      service.load('machine-1').subscribe({ next: resolve, error: reject }),
    );
    signalsApi.remove.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.remove('machine-1', 'signal-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.signals()).toEqual([]);
  });
});

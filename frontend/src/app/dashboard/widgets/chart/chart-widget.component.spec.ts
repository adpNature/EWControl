import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalUpdatedEvent } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { ChartWidgetComponent } from './chart-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'CHART',
  widgetConfig: { maxPoints: 3 },
  position: 0,
  signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
};

function emit(subject: Subject<SignalUpdatedEvent>, value: number, timestamp: string): void {
  subject.next({ signalId: 'signal-1', machineId: 'machine-1', value, quality: 'GOOD', timestamp });
}

function createSignalsApi(historyPoints: { timestamp: string; value: number }[] = []) {
  return {
    getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))),
    getHistory: vi
      .fn()
      .mockReturnValue(of({ signalId: 'signal-1', resolution: 'raw', points: historyPoints })),
  };
}

describe('ChartWidgetComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('al abrirse, carga histórico real de la última hora sin esperar al WebSocket', async () => {
    const signalsApi = createSignalsApi([
      { timestamp: '2026-07-12T11:30:00Z', value: 22.5 },
      { timestamp: '2026-07-12T11:45:00Z', value: 24.8 },
    ]);
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    const { fixture } = await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(signalsApi.getHistory).toHaveBeenCalledWith('machine-1', 'signal-1', {
      from: new Date('2026-07-12T11:00:00Z'),
      to: new Date('2026-07-12T12:00:00Z'),
    });
    expect(fixture.componentInstance.points()).toEqual([
      { t: new Date('2026-07-12T11:30:00Z').getTime(), v: 22.5 },
      { t: new Date('2026-07-12T11:45:00Z').getTime(), v: 24.8 },
    ]);
  });

  it('sin datos en el rango muestra "Sin datos disponibles"', async () => {
    const signalsApi = createSignalsApi([]);
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
  });

  it('un fallo al consultar histórico degrada a modo solo tiempo real, sin bloquear el widget', async () => {
    const signalsApi = {
      getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))),
      getHistory: vi.fn().mockReturnValue(throwError(() => new Error('network error'))),
    };
    const signalUpdates$ = new Subject<SignalUpdatedEvent>();
    const realtimeSocket = { signalUpdates$ };

    const { fixture } = await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });
    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();

    emit(signalUpdates$, 24.8, '2026-07-12T12:00:01Z');
    await screen.findByText(/24.8/);

    expect(fixture.componentInstance.points()).toEqual([
      { t: new Date('2026-07-12T12:00:01Z').getTime(), v: 24.8 },
    ]);
  });

  it('cambiar el rango dispara una nueva consulta y sustituye la serie de puntos', async () => {
    const signalsApi = createSignalsApi([{ timestamp: '2026-07-12T11:45:00Z', value: 22.5 }]);
    signalsApi.getHistory
      .mockReturnValueOnce(
        of({
          signalId: 'signal-1',
          resolution: 'raw',
          points: [{ timestamp: '2026-07-12T11:45:00Z', value: 22.5 }],
        }),
      )
      .mockReturnValueOnce(
        of({
          signalId: 'signal-1',
          resolution: 'hour',
          points: [{ timestamp: '2026-07-11T12:00:00Z', value: 18.2 }],
        }),
      );
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };
    const { fixture } = await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('button', { name: 'Último día' }));

    expect(signalsApi.getHistory).toHaveBeenCalledTimes(2);
    expect(signalsApi.getHistory).toHaveBeenLastCalledWith('machine-1', 'signal-1', {
      from: new Date('2026-07-11T12:00:00Z'),
      to: new Date('2026-07-12T12:00:00Z'),
    });
    expect(fixture.componentInstance.points()).toEqual([
      { t: new Date('2026-07-11T12:00:00Z').getTime(), v: 18.2 },
    ]);
  });

  it('acumula puntos recibidos por WebSocket sobre el histórico cargado, acotados por maxPoints', async () => {
    const signalsApi = createSignalsApi([]);
    const signalUpdates$ = new Subject<SignalUpdatedEvent>();
    const realtimeSocket = { signalUpdates$ };
    const component = await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    emit(signalUpdates$, 10, '2026-07-12T10:00:00Z');
    emit(signalUpdates$, 20, '2026-07-12T10:00:01Z');
    emit(signalUpdates$, 30, '2026-07-12T10:00:02Z');
    emit(signalUpdates$, 40, '2026-07-12T10:00:03Z');
    await screen.findByText(/40/);

    expect(component.fixture.componentInstance.points()).toEqual([
      { t: new Date('2026-07-12T10:00:01Z').getTime(), v: 20 },
      { t: new Date('2026-07-12T10:00:02Z').getTime(), v: 30 },
      { t: new Date('2026-07-12T10:00:03Z').getTime(), v: 40 },
    ]);
  });
});

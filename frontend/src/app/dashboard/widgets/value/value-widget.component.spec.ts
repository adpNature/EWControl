import { render, screen } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalUpdatedEvent } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { ValueWidgetComponent } from './value-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'VALUE',
  widgetConfig: {},
  position: 0,
  signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
};

describe('ValueWidgetComponent', () => {
  it('muestra el valor inicial obtenido vía REST con su unidad y calidad', async () => {
    const signalsApi = {
      getValue: vi.fn().mockReturnValue(
        of({
          signalId: 'signal-1',
          value: 24.8,
          quality: 'GOOD',
          timestamp: '2026-07-12T10:00:00Z',
          updatedAt: '2026-07-12T10:00:00Z',
        }),
      ),
    };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(ValueWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText(/24,80/)).toBeInTheDocument();
    expect(screen.getByText('°C')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('muestra "Sin datos disponibles" si la Realtime Cache no tiene valor (404)', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(ValueWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
  });

  it('actualiza el valor en vivo al llegar un SignalUpdated de su propia Signal', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const signalUpdates$ = new Subject<SignalUpdatedEvent>();
    const realtimeSocket = { signalUpdates$ };

    await render(ValueWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });
    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();

    signalUpdates$.next({
      signalId: 'signal-1',
      machineId: 'machine-1',
      value: 30,
      quality: 'GOOD',
      timestamp: '2026-07-12T10:00:05Z',
    });

    expect(await screen.findByText(/30/)).toBeInTheDocument();
  });

  it('ignora SignalUpdated de otras Signals', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const signalUpdates$ = new Subject<SignalUpdatedEvent>();
    const realtimeSocket = { signalUpdates$ };

    await render(ValueWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    signalUpdates$.next({
      signalId: 'other-signal',
      machineId: 'machine-1',
      value: 999,
      quality: 'GOOD',
      timestamp: '2026-07-12T10:00:05Z',
    });

    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
  });
});

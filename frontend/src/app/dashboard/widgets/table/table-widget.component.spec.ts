import { render, screen } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalUpdatedEvent } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { TableWidgetComponent } from './table-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'TABLE',
  widgetConfig: {},
  position: 0,
  signals: [
    { id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' },
    { id: 'signal-2', name: 'Presión', unit: 'bar', machineId: 'machine-1' },
  ],
};

describe('TableWidgetComponent', () => {
  it('muestra una fila por Signal con su valor inicial', async () => {
    const signalsApi = {
      getValue: vi.fn((machineId: string, id: string) =>
        of({
          signalId: id,
          value: id === 'signal-1' ? 24.8 : 2.5,
          quality: 'GOOD' as const,
          timestamp: '2026-07-12T10:00:00Z',
          updatedAt: '2026-07-12T10:00:00Z',
        }),
      ),
    };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(TableWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText('Temperatura')).toBeInTheDocument();
    expect(screen.getByText('Presión')).toBeInTheDocument();
    expect(screen.getByText(/24,80/)).toBeInTheDocument();
    expect(screen.getByText(/2,50/)).toBeInTheDocument();
  });

  it('muestra "Sin datos" para una Signal sin entrada en la Realtime Cache', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(TableWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getAllByText('Sin datos')).toHaveLength(2);
  });

  it('actualiza solo la fila de la Signal que recibe el SignalUpdated', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const signalUpdates$ = new Subject<SignalUpdatedEvent>();
    const realtimeSocket = { signalUpdates$ };

    await render(TableWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    signalUpdates$.next({
      signalId: 'signal-2',
      machineId: 'machine-1',
      value: 3.1,
      quality: 'GOOD',
      timestamp: '2026-07-12T10:00:05Z',
    });

    expect(await screen.findByText(/3,10/)).toBeInTheDocument();
    expect(screen.getAllByText('Sin datos')).toHaveLength(1);
  });
});

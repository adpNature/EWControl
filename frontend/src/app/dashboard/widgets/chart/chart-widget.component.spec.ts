import { render, screen } from '@testing-library/angular';
import { Subject, throwError } from 'rxjs';
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

describe('ChartWidgetComponent', () => {
  it('sin puntos todavía muestra "Sin datos disponibles" y nunca consulta histórico', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(ChartWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
    expect(signalsApi.getValue).toHaveBeenCalledTimes(1);
    expect((signalsApi as Record<string, unknown>)['getHistory']).toBeUndefined();
  });

  it('acumula puntos recibidos por WebSocket, acotados por maxPoints', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
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

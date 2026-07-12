import { render, screen } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalUpdatedEvent } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { GaugeWidgetComponent } from './gauge-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'GAUGE',
  widgetConfig: { min: 0, max: 100 },
  position: 0,
  signals: [{ id: 'signal-1', name: 'Velocidad', unit: 'rpm', machineId: 'machine-1' }],
};

describe('GaugeWidgetComponent', () => {
  it('muestra el valor inicial y su calidad', async () => {
    const signalsApi = {
      getValue: vi.fn().mockReturnValue(
        of({
          signalId: 'signal-1',
          value: 50,
          quality: 'GOOD',
          timestamp: '2026-07-12T10:00:00Z',
          updatedAt: '2026-07-12T10:00:00Z',
        }),
      ),
    };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(GaugeWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText(/50/)).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('muestra "Sin datos disponibles" sin entrada en la Realtime Cache', async () => {
    const signalsApi = { getValue: vi.fn().mockReturnValue(throwError(() => new Error('404'))) };
    const realtimeSocket = { signalUpdates$: new Subject<SignalUpdatedEvent>() };

    await render(GaugeWidgetComponent, {
      inputs: { widget: WIDGET },
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: RealtimeSocketService, useValue: realtimeSocket },
      ],
    });

    expect(screen.getByText('Sin datos disponibles')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/angular';
import { Subject, of, throwError } from 'rxjs';
import { AlarmDefinitionsApiService } from '../../../alarms/adapters/alarm-definitions-api.service';
import { AlarmStatesApiService } from '../../../alarms/adapters/alarm-states-api.service';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { AlarmListWidgetComponent } from './alarm-list-widget.component';

const WIDGET: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'ALARM_LIST',
  widgetConfig: {},
  position: 0,
  signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
};

const VISIBLE_DEFINITION = {
  id: 'def-1',
  signalId: 'signal-1',
  operator: '>' as const,
  threshold: 80,
  priority: 'HIGH' as const,
  notifyByEmail: false,
  showOnDashboard: true,
  isActive: true,
};

const HIDDEN_DEFINITION = { ...VISIBLE_DEFINITION, id: 'def-2', showOnDashboard: false };

const ACTIVE_STATE = {
  id: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  status: 'ACTIVE' as const,
  priority: 'HIGH' as const,
  activatedAt: '2026-07-13T10:00:00Z',
  resolvedAt: null,
};

function createFakes() {
  const alarmDefinitionsApi = { list: vi.fn().mockReturnValue(of([VISIBLE_DEFINITION])) };
  const alarmStatesApi = {
    list: vi.fn().mockReturnValue(of({ data: [ACTIVE_STATE], total: 1, limit: 100, offset: 0 })),
  };
  const alarmTriggeredSubject = new Subject<unknown>();
  const alarmClearedSubject = new Subject<unknown>();
  const realtimeSocket = {
    alarmTriggered$: alarmTriggeredSubject.asObservable(),
    alarmCleared$: alarmClearedSubject.asObservable(),
  };
  return {
    alarmDefinitionsApi,
    alarmStatesApi,
    realtimeSocket,
    alarmTriggeredSubject,
    alarmClearedSubject,
  };
}

function renderWidget(fakes: ReturnType<typeof createFakes>) {
  return render(AlarmListWidgetComponent, {
    inputs: { widget: WIDGET },
    providers: [
      { provide: AlarmDefinitionsApiService, useValue: fakes.alarmDefinitionsApi },
      { provide: AlarmStatesApiService, useValue: fakes.alarmStatesApi },
      { provide: RealtimeSocketService, useValue: fakes.realtimeSocket },
    ],
  });
}

describe('AlarmListWidgetComponent', () => {
  it('muestra las alarmas activas de sus Signals con showOnDashboard habilitado', async () => {
    const fakes = createFakes();

    await renderWidget(fakes);

    expect(await screen.findByText('Temperatura')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('excluye las alarmas de reglas con showOnDashboard en false', async () => {
    const fakes = createFakes();
    fakes.alarmDefinitionsApi.list.mockReturnValue(of([HIDDEN_DEFINITION]));

    await renderWidget(fakes);

    expect(await screen.findByText('Sin alarmas activas.')).toBeInTheDocument();
  });

  it('sin alarmas activas muestra un estado vacío explícito', async () => {
    const fakes = createFakes();
    fakes.alarmStatesApi.list.mockReturnValue(of({ data: [], total: 0, limit: 100, offset: 0 }));

    await renderWidget(fakes);

    expect(await screen.findByText('Sin alarmas activas.')).toBeInTheDocument();
  });

  it('un fallo de REST degrada a un estado explícito, sin romper el widget', async () => {
    const fakes = createFakes();
    fakes.alarmStatesApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await renderWidget(fakes);

    expect(await screen.findByText('No se han podido cargar las alarmas.')).toBeInTheDocument();
  });

  it('un AlarmTriggered en vivo de una regla visible añade la alarma a la lista', async () => {
    const fakes = createFakes();
    fakes.alarmStatesApi.list.mockReturnValue(of({ data: [], total: 0, limit: 100, offset: 0 }));
    await renderWidget(fakes);
    expect(await screen.findByText('Sin alarmas activas.')).toBeInTheDocument();

    fakes.alarmTriggeredSubject.next({
      alarmStateId: 'state-2',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      priority: 'CRITICAL',
      timestamp: '2026-07-13T11:00:00Z',
    });

    expect(await screen.findByText('Temperatura')).toBeInTheDocument();
    expect(screen.getByText('Crítica')).toBeInTheDocument();
  });

  it('un AlarmCleared en vivo retira la alarma de la lista', async () => {
    const fakes = createFakes();
    await renderWidget(fakes);
    expect(await screen.findByText('Temperatura')).toBeInTheDocument();

    fakes.alarmClearedSubject.next({
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      timestamp: '2026-07-13T12:00:00Z',
    });

    expect(await screen.findByText('Sin alarmas activas.')).toBeInTheDocument();
  });
});

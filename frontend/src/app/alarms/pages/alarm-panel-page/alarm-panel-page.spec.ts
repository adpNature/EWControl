import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject, of } from 'rxjs';
import { MachinesState } from '../../../config/use-cases/machines.state';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { AlarmStatesState } from '../../use-cases/alarm-states.state';
import { AlarmPanelPage } from './alarm-panel-page';

const ALARM_STATE_1 = {
  id: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  status: 'ACTIVE' as const,
  priority: 'HIGH' as const,
  activatedAt: '2026-07-13T10:00:00Z',
  resolvedAt: null,
};

describe('AlarmPanelPage', () => {
  let alarmStatesState: {
    alarmStates: ReturnType<typeof vi.fn>;
    loading: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    applyTriggered: ReturnType<typeof vi.fn>;
    applyCleared: ReturnType<typeof vi.fn>;
  };
  let machinesState: { machines: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> };
  let alarmTriggeredSubject: Subject<unknown>;
  let alarmClearedSubject: Subject<unknown>;

  beforeEach(() => {
    alarmTriggeredSubject = new Subject();
    alarmClearedSubject = new Subject();
    alarmStatesState = {
      alarmStates: vi.fn().mockReturnValue([ALARM_STATE_1]),
      loading: vi.fn().mockReturnValue(false),
      load: vi.fn().mockReturnValue(of([ALARM_STATE_1])),
      applyTriggered: vi.fn(),
      applyCleared: vi.fn(),
    };
    machinesState = {
      machines: vi.fn().mockReturnValue([]),
      load: vi.fn().mockReturnValue(of([])),
    };
  });

  function renderPage() {
    return render(AlarmPanelPage, {
      providers: [
        { provide: AlarmStatesState, useValue: alarmStatesState },
        { provide: MachinesState, useValue: machinesState },
        {
          provide: RealtimeSocketService,
          useValue: {
            alarmTriggered$: alarmTriggeredSubject.asObservable(),
            alarmCleared$: alarmClearedSubject.asObservable(),
          },
        },
      ],
    });
  }

  it('carga las alarmas al iniciar y las lista', async () => {
    await renderPage();

    expect(alarmStatesState.load).toHaveBeenCalledWith({
      status: undefined,
      machineId: undefined,
      priority: undefined,
    });
    expect(screen.getByText('signal-1')).toBeInTheDocument();
  });

  it('cambiar el filtro de estado vuelve a pedir la lista con ese filtro', async () => {
    await renderPage();
    alarmStatesState.load.mockClear();

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'ACTIVE');

    expect(alarmStatesState.load).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE' }),
    );
  });

  it('un AlarmTriggered recibido por WebSocket se aplica al estado', async () => {
    await renderPage();

    alarmTriggeredSubject.next({
      alarmStateId: 'state-2',
      alarmDefinitionId: 'def-2',
      signalId: 'signal-2',
      priority: 'CRITICAL',
      timestamp: '2026-07-13T11:00:00Z',
    });

    expect(alarmStatesState.applyTriggered).toHaveBeenCalledWith(
      expect.objectContaining({ alarmStateId: 'state-2' }),
    );
  });

  it('sin alarmas para el filtro seleccionado muestra un estado vacío explícito', async () => {
    alarmStatesState.alarmStates.mockReturnValue([]);
    await renderPage();

    expect(screen.getByText('No hay alarmas para los filtros seleccionados.')).toBeInTheDocument();
  });
});

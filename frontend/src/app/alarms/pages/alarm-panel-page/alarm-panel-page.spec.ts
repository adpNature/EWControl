import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject, of, throwError } from 'rxjs';
import { MachinesState } from '../../../config/use-cases/machines.state';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
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
  ackedAt: null,
  ackedByUserId: null,
  ackedByEmail: null,
};

const ACKED_ALARM_STATE = {
  ...ALARM_STATE_1,
  id: 'state-3',
  ackedAt: '2026-07-13T12:00:00Z',
  ackedByUserId: 'user-1',
  ackedByEmail: 'admin@ewcontrol.local',
};

describe('AlarmPanelPage', () => {
  let alarmStatesState: {
    alarmStates: ReturnType<typeof vi.fn>;
    loading: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    applyTriggered: ReturnType<typeof vi.fn>;
    applyCleared: ReturnType<typeof vi.fn>;
    ack: ReturnType<typeof vi.fn>;
    applyAcked: ReturnType<typeof vi.fn>;
  };
  let machinesState: { machines: ReturnType<typeof vi.fn>; load: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };
  let alarmTriggeredSubject: Subject<unknown>;
  let alarmClearedSubject: Subject<unknown>;
  let alarmAckedSubject: Subject<unknown>;

  beforeEach(() => {
    alarmTriggeredSubject = new Subject();
    alarmClearedSubject = new Subject();
    alarmAckedSubject = new Subject();
    alarmStatesState = {
      alarmStates: vi.fn().mockReturnValue([ALARM_STATE_1]),
      loading: vi.fn().mockReturnValue(false),
      load: vi.fn().mockReturnValue(of([ALARM_STATE_1])),
      applyTriggered: vi.fn(),
      applyCleared: vi.fn(),
      ack: vi.fn().mockReturnValue(of(ACKED_ALARM_STATE)),
      applyAcked: vi.fn(),
    };
    machinesState = {
      machines: vi.fn().mockReturnValue([]),
      load: vi.fn().mockReturnValue(of([])),
    };
    toastService = { show: vi.fn() };
  });

  function renderPage() {
    return render(AlarmPanelPage, {
      providers: [
        { provide: AlarmStatesState, useValue: alarmStatesState },
        { provide: MachinesState, useValue: machinesState },
        { provide: ToastService, useValue: toastService },
        {
          provide: RealtimeSocketService,
          useValue: {
            alarmTriggered$: alarmTriggeredSubject.asObservable(),
            alarmCleared$: alarmClearedSubject.asObservable(),
            alarmAcked$: alarmAckedSubject.asObservable(),
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

  it('un AlarmAcked recibido por WebSocket se aplica al estado (docs/specs/11-ack-alarmas.md)', async () => {
    await renderPage();

    alarmAckedSubject.next({
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
      ackedAt: '2026-07-13T12:00:00Z',
    });

    expect(alarmStatesState.applyAcked).toHaveBeenCalledWith(
      expect.objectContaining({ alarmStateId: 'state-1' }),
    );
  });

  it('muestra "Reconocer" para una alarma sin reconocer, y al pulsarlo la reconoce con toast de éxito', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Reconocer' }));

    expect(alarmStatesState.ack).toHaveBeenCalledWith('state-1');
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Alarma reconocida.',
    });
  });

  it('un fallo al reconocer muestra un toast de error y no oculta la acción', async () => {
    alarmStatesState.ack.mockReturnValue(throwError(() => new Error('network error')));
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Reconocer' }));

    expect(toastService.show).toHaveBeenCalledWith({
      type: 'danger',
      message: 'No se ha podido reconocer la alarma.',
    });
    expect(screen.getByRole('button', { name: 'Reconocer' })).toBeInTheDocument();
  });

  it('una alarma ya reconocida muestra quién y cuándo, sin la acción "Reconocer"', async () => {
    alarmStatesState.alarmStates.mockReturnValue([ACKED_ALARM_STATE]);
    await renderPage();

    expect(screen.queryByRole('button', { name: 'Reconocer' })).not.toBeInTheDocument();
    expect(screen.getByText(/admin@ewcontrol\.local/)).toBeInTheDocument();
  });
});

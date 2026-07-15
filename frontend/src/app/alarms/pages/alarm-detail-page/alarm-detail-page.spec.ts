import { ActivatedRoute } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject, of, throwError } from 'rxjs';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AlarmStatesApiService } from '../../adapters/alarm-states-api.service';
import { AlarmDetailPage } from './alarm-detail-page';

function activatedRouteStub(id: string) {
  return { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? id : null) } } };
}

const DETAIL = {
  id: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  status: 'ACTIVE',
  priority: 'HIGH',
  activatedAt: '2026-07-13T10:00:00Z',
  resolvedAt: null,
  ackedAt: null,
  ackedByUserId: null,
  ackedByEmail: null,
  history: [
    {
      id: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      status: 'ACTIVE',
      priority: 'HIGH',
      activatedAt: '2026-07-13T10:00:00Z',
      resolvedAt: null,
      ackedAt: null,
      ackedByUserId: null,
      ackedByEmail: null,
    },
  ],
};

describe('AlarmDetailPage', () => {
  let alarmStatesApi: { get: ReturnType<typeof vi.fn>; ack: ReturnType<typeof vi.fn> };
  let toastService: { show: ReturnType<typeof vi.fn> };
  let alarmAckedSubject: Subject<unknown>;

  beforeEach(() => {
    alarmStatesApi = { get: vi.fn(), ack: vi.fn() };
    toastService = { show: vi.fn() };
    alarmAckedSubject = new Subject();
  });

  function renderPage(id = 'state-1') {
    return render(AlarmDetailPage, {
      providers: [
        { provide: AlarmStatesApiService, useValue: alarmStatesApi },
        { provide: ActivatedRoute, useValue: activatedRouteStub(id) },
        { provide: ToastService, useValue: toastService },
        {
          provide: RealtimeSocketService,
          useValue: { alarmAcked$: alarmAckedSubject.asObservable() },
        },
      ],
    });
  }

  it('muestra el estado, la prioridad y el histórico de la alarma', async () => {
    alarmStatesApi.get.mockReturnValue(of(DETAIL));

    await renderPage();

    expect((await screen.findAllByText('ACTIVE')).length).toBeGreaterThan(0);
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(alarmStatesApi.get).toHaveBeenCalledWith('state-1');
  });

  it('sin acceso o inexistente muestra un mensaje explícito, sin romper la página', async () => {
    alarmStatesApi.get.mockReturnValue(
      throwError(() => ({ status: 404, code: 'ALARM_STATE_NOT_FOUND', message: 'x' })),
    );

    await renderPage();

    expect(await screen.findByText(/ya no existe o no tienes acceso/)).toBeInTheDocument();
  });

  it('muestra "Reconocer" para una alarma sin reconocer, y al pulsarlo la reconoce con toast de éxito', async () => {
    alarmStatesApi.get.mockReturnValue(of(DETAIL));
    const acked = {
      ...DETAIL,
      ackedAt: '2026-07-13T12:00:00Z',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
    };
    alarmStatesApi.ack.mockReturnValue(of(acked));
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Reconocer' }));

    expect(alarmStatesApi.ack).toHaveBeenCalledWith('state-1');
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Alarma reconocida.',
    });
    expect(await screen.findByText(/admin@ewcontrol\.local/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconocer' })).not.toBeInTheDocument();
  });

  it('un fallo al reconocer muestra un toast de error y mantiene visible la acción', async () => {
    alarmStatesApi.get.mockReturnValue(of(DETAIL));
    alarmStatesApi.ack.mockReturnValue(throwError(() => new Error('network error')));
    await renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Reconocer' }));

    expect(toastService.show).toHaveBeenCalledWith({
      type: 'danger',
      message: 'No se ha podido reconocer la alarma.',
    });
    expect(screen.getByRole('button', { name: 'Reconocer' })).toBeInTheDocument();
  });

  it('un AlarmAcked recibido por WebSocket para esta misma alarma actualiza la vista sin recargar', async () => {
    alarmStatesApi.get.mockReturnValue(of(DETAIL));
    await renderPage();
    await screen.findByRole('button', { name: 'Reconocer' });

    alarmAckedSubject.next({
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      ackedByUserId: 'user-2',
      ackedByEmail: 'other@ewcontrol.local',
      ackedAt: '2026-07-13T13:00:00Z',
    });

    expect(await screen.findByText(/other@ewcontrol\.local/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconocer' })).not.toBeInTheDocument();
  });
});

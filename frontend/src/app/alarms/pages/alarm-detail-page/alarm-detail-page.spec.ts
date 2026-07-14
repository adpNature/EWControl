import { ActivatedRoute } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { AlarmStatesApiService } from '../../adapters/alarm-states-api.service';
import { AlarmDetailPage } from './alarm-detail-page';

function activatedRouteStub(id: string) {
  return { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? id : null) } } };
}

describe('AlarmDetailPage', () => {
  let alarmStatesApi: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    alarmStatesApi = { get: vi.fn() };
  });

  function renderPage(id = 'state-1') {
    return render(AlarmDetailPage, {
      providers: [
        { provide: AlarmStatesApiService, useValue: alarmStatesApi },
        { provide: ActivatedRoute, useValue: activatedRouteStub(id) },
      ],
    });
  }

  it('muestra el estado, la prioridad y el histórico de la alarma', async () => {
    alarmStatesApi.get.mockReturnValue(
      of({
        id: 'state-1',
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        status: 'ACTIVE',
        priority: 'HIGH',
        activatedAt: '2026-07-13T10:00:00Z',
        resolvedAt: null,
        history: [
          {
            id: 'state-1',
            alarmDefinitionId: 'def-1',
            signalId: 'signal-1',
            status: 'ACTIVE',
            priority: 'HIGH',
            activatedAt: '2026-07-13T10:00:00Z',
            resolvedAt: null,
          },
        ],
      }),
    );

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
});

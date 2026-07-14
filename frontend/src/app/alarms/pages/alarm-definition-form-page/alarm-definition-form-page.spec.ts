import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { AlarmDefinitionsState } from '../../use-cases/alarm-definitions.state';
import { AlarmDefinitionFormPage } from './alarm-definition-form-page';

function activatedRouteStub(alarmDefinitionId: string | null) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => {
          if (key === 'machineId') return 'machine-1';
          if (key === 'signalId') return 'signal-1';
          if (key === 'alarmDefinitionId') return alarmDefinitionId;
          return null;
        },
      },
    },
  };
}

describe('AlarmDefinitionFormPage', () => {
  let alarmDefinitionsState: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    load: ReturnType<typeof vi.fn>;
    definitions: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    alarmDefinitionsState = {
      create: vi.fn(),
      update: vi.fn(),
      load: vi.fn(),
      definitions: vi.fn().mockReturnValue([]),
    };
    router = { navigate: vi.fn() };
  });

  function renderPage(alarmDefinitionId: string | null = null) {
    return render(AlarmDefinitionFormPage, {
      providers: [
        { provide: AlarmDefinitionsState, useValue: alarmDefinitionsState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(alarmDefinitionId) },
      ],
    });
  }

  it('crea una regla numérica y navega de vuelta a la Signal', async () => {
    alarmDefinitionsState.create.mockReturnValue(of({ id: 'def-1' }));
    await renderPage();

    await userEvent.selectOptions(screen.getByLabelText('Operador'), '>');
    await userEvent.type(screen.getByLabelText('Umbral (número)'), '80');
    await userEvent.selectOptions(screen.getByLabelText('Prioridad'), 'HIGH');
    await userEvent.click(screen.getByLabelText('Notificar por email'));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(alarmDefinitionsState.create).toHaveBeenCalledWith('signal-1', {
      operator: '>',
      threshold: 80,
      priority: 'HIGH',
      notifyByEmail: true,
      showOnDashboard: true,
    });
    expect(router.navigate).toHaveBeenCalledWith([
      '/config/machines',
      'machine-1',
      'signals',
      'signal-1',
      'edit',
    ]);
  });

  it('con operator == acepta un umbral booleano', async () => {
    alarmDefinitionsState.create.mockReturnValue(of({ id: 'def-1' }));
    await renderPage();

    await userEvent.selectOptions(screen.getByLabelText('Operador'), '==');
    await userEvent.type(screen.getByLabelText('Umbral'), 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(alarmDefinitionsState.create).toHaveBeenCalledWith(
      'signal-1',
      expect.objectContaining({ operator: '==', threshold: true }),
    );
  });

  it('rechaza en cliente un umbral no numérico cuando el operador es numérico', async () => {
    await renderPage();

    await userEvent.selectOptions(screen.getByLabelText('Operador'), '>');
    await userEvent.type(screen.getByLabelText('Umbral (número)'), 'ochenta');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/debe ser un número/)).toBeInTheDocument();
    expect(alarmDefinitionsState.create).not.toHaveBeenCalled();
  });

  it('modo edición: precarga la regla ya cacheada en el estado', async () => {
    alarmDefinitionsState.definitions.mockReturnValue([
      {
        id: 'def-1',
        signalId: 'signal-1',
        operator: '<=',
        threshold: 10,
        priority: 'LOW',
        notifyByEmail: false,
        showOnDashboard: true,
        isActive: true,
      },
    ]);

    await renderPage('def-1');

    expect(await screen.findByLabelText('Umbral (número)')).toHaveValue('10');
    expect(screen.getByLabelText('Operador')).toHaveValue('<=');
  });

  it('un error del servidor se muestra sin perder los datos del formulario', async () => {
    alarmDefinitionsState.create.mockReturnValue(
      throwError(() => ({ status: 404, code: 'SIGNAL_NOT_FOUND', message: 'x' })),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Umbral (número)'), '80');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/ya no existe/)).toBeInTheDocument();
    expect(screen.getByLabelText('Umbral (número)')).toHaveValue('80');
  });
});

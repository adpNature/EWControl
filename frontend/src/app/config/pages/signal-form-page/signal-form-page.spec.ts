import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { SignalsApiService } from '../../adapters/signals-api.service';
import { SignalsState } from '../../use-cases/signals.state';
import { SignalFormPage } from './signal-form-page';

function activatedRouteStub(signalId: string | null) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => {
          if (key === 'machineId') return 'machine-1';
          if (key === 'signalId') return signalId;
          return null;
        },
      },
    },
  };
}

describe('SignalFormPage', () => {
  let signalsApi: { get: ReturnType<typeof vi.fn> };
  let signalsState: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    signalsApi = { get: vi.fn() };
    signalsState = { create: vi.fn(), update: vi.fn() };
    router = { navigate: vi.fn() };
  });

  function renderPage(signalId: string | null = null) {
    return render(SignalFormPage, {
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: SignalsState, useValue: signalsState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(signalId) },
      ],
    });
  }

  it('por defecto muestra el campo Variable (DIRECT)', async () => {
    await renderPage();

    expect(screen.getByLabelText('Variable')).toBeInTheDocument();
    expect(screen.queryByLabelText('Expresión')).not.toBeInTheDocument();
  });

  it('al elegir FORMULA muestra Expresión y Variables en vez de Variable', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('radio', { name: /Fórmula/ }));

    expect(screen.queryByLabelText('Variable')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Expresión')).toBeInTheDocument();
    expect(screen.getByLabelText('Variables (separadas por coma)')).toBeInTheDocument();
  });

  it('crea una Signal DIRECT con la Variable indicada', async () => {
    signalsState.create.mockReturnValue(
      of({ id: 'signal-1', machineId: 'machine-1', name: 'Temperatura' }),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Temperatura');
    await userEvent.type(screen.getByLabelText('Unidad'), '°C');
    await userEvent.type(screen.getByLabelText('Variable'), 'temperature');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(signalsState.create).toHaveBeenCalledWith('machine-1', {
      name: 'Temperatura',
      unit: '°C',
      signalType: 'DIRECT',
      signalSource: { variableName: 'temperature' },
    });
    expect(router.navigate).toHaveBeenCalledWith(['/config/machines', 'machine-1']);
  });

  it('crea una Signal FORMULA separando las variables por coma', async () => {
    signalsState.create.mockReturnValue(
      of({ id: 'signal-2', machineId: 'machine-1', name: 'Diferencial' }),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Diferencial');
    await userEvent.type(screen.getByLabelText('Unidad'), 'u');
    await userEvent.click(screen.getByRole('radio', { name: /Fórmula/ }));
    await userEvent.type(screen.getByLabelText('Expresión'), 'a - b');
    await userEvent.type(screen.getByLabelText('Variables (separadas por coma)'), 'a, b');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(signalsState.create).toHaveBeenCalledWith('machine-1', {
      name: 'Diferencial',
      unit: 'u',
      signalType: 'FORMULA',
      signalSource: { expression: 'a - b', variables: ['a', 'b'] },
    });
  });

  it('modo edición: precarga los datos existentes y deshabilita el tipo', async () => {
    signalsApi.get.mockReturnValue(
      of({
        id: 'signal-1',
        machineId: 'machine-1',
        name: 'Temperatura',
        signalType: 'DIRECT',
        signalSource: { variableName: 'temperature' },
        unit: '°C',
        historyEnabled: false,
      }),
    );

    await renderPage('signal-1');

    expect(await screen.findByLabelText('Nombre')).toHaveValue('Temperatura');
    expect(screen.getByLabelText('Variable')).toHaveValue('temperature');
    expect(screen.getByRole('radio', { name: /Directa/ })).toBeDisabled();
  });

  it('un 422 FORMULA_REFERENCES_UNKNOWN_VARIABLE asocia el error al campo variables sin perder el formulario', async () => {
    signalsState.create.mockReturnValue(
      throwError(() => ({
        status: 422,
        code: 'FORMULA_REFERENCES_UNKNOWN_VARIABLE',
        message: 'irrelevante',
      })),
    );
    await renderPage();

    await userEvent.type(screen.getByLabelText('Nombre'), 'Diferencial');
    await userEvent.type(screen.getByLabelText('Unidad'), 'u');
    await userEvent.click(screen.getByRole('radio', { name: /Fórmula/ }));
    await userEvent.type(screen.getByLabelText('Expresión'), 'a - z');
    await userEvent.type(screen.getByLabelText('Variables (separadas por coma)'), 'a, z');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/no existe en esta Machine/)).toBeInTheDocument();
    expect(screen.getByLabelText('Expresión')).toHaveValue('a - z');
  });
});

import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MachinesApiService } from '../../../../config/adapters/machines-api.service';
import { SignalsApiService } from '../../../../config/adapters/signals-api.service';
import { SignalPickerComponent } from './signal-picker.component';

const MACHINE_1 = { id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1' };
const MACHINE_2 = { id: 'machine-2', companyId: 'company-1', name: 'Bobinadora 2' };
const SIGNAL_1 = {
  id: 'signal-1',
  machineId: 'machine-1',
  name: 'Temperatura',
  unit: '°C',
  signalType: 'DIRECT',
  signalSource: { variableName: 'temperature' },
  historyEnabled: true,
};
const SIGNAL_2 = {
  id: 'signal-2',
  machineId: 'machine-2',
  name: 'Presión',
  unit: 'bar',
  signalType: 'DIRECT',
  signalSource: { variableName: 'pressure' },
  historyEnabled: true,
};

function createApis() {
  const machinesApi = {
    list: vi.fn().mockReturnValue(of({ data: [MACHINE_1, MACHINE_2], total: 2 })),
  };
  const signalsApi = {
    list: vi.fn((machineId: string) =>
      of({ data: machineId === MACHINE_1.id ? [SIGNAL_1] : [SIGNAL_2] }),
    ),
  };
  return { machinesApi, signalsApi };
}

describe('SignalPickerComponent', () => {
  it('agrupa las Signals por Machine, de todas las Machines de la Company', async () => {
    const { machinesApi, signalsApi } = createApis();

    await render(SignalPickerComponent, {
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
      ],
    });

    expect(await screen.findByText('Bobinadora 1')).toBeInTheDocument();
    expect(screen.getByText('Bobinadora 2')).toBeInTheDocument();
    expect(screen.getByLabelText(/Temperatura/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Presión/)).toBeInTheDocument();
  });

  it('marcar una Signal emite selectionChange con el id añadido', async () => {
    const { machinesApi, signalsApi } = createApis();
    const { fixture } = await render(SignalPickerComponent, {
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
      ],
    });
    const emitted: string[][] = [];
    fixture.componentInstance.selectionChange.subscribe((ids: string[]) => emitted.push(ids));

    await userEvent.click(await screen.findByLabelText(/Temperatura/));

    expect(emitted).toEqual([['signal-1']]);
  });

  it('desmarcar una Signal ya seleccionada emite selectionChange sin ese id', async () => {
    const { machinesApi, signalsApi } = createApis();
    const { fixture } = await render(SignalPickerComponent, {
      componentInputs: { selectedSignalIds: ['signal-1'] },
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
      ],
    });
    const emitted: string[][] = [];
    fixture.componentInstance.selectionChange.subscribe((ids: string[]) => emitted.push(ids));

    await userEvent.click(await screen.findByLabelText(/Temperatura/));

    expect(emitted).toEqual([[]]);
  });

  it('con el tope de 8 alcanzado, deshabilita el resto de checkboxes', async () => {
    const { machinesApi, signalsApi } = createApis();
    const eightIds = Array.from({ length: 8 }, (element, index) => `signal-selected-${index}`);

    await render(SignalPickerComponent, {
      componentInputs: { selectedSignalIds: eightIds },
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
      ],
    });

    expect(await screen.findByLabelText(/Temperatura/)).toBeDisabled();
    expect(screen.getByText(/Máximo 8 Signals/)).toBeInTheDocument();
  });

  it('sin Machines en la Company, muestra un mensaje sin datos', async () => {
    const machinesApi = { list: vi.fn().mockReturnValue(of({ data: [], total: 0 })) };
    const signalsApi = { list: vi.fn() };

    await render(SignalPickerComponent, {
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: signalsApi },
      ],
    });

    expect(await screen.findByText('No hay Signals disponibles.')).toBeInTheDocument();
    expect(signalsApi.list).not.toHaveBeenCalled();
  });
});

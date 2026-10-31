import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { WritePackagesApiService } from '../../../write-packages/adapters/write-packages-api.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { MachineConnection } from '../../entities/machine-connection.model';
import { WritePackageFormPage } from './write-package-form-page';

const CONNECTION: MachineConnection = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: 'OpcUa',
  connectionConfig: {
    endpointUrl: 'opc.tcp://192.168.1.1:4840',
    securityMode: 'None',
    securityPolicy: 'None',
    authMode: 'Anonymous',
    timeoutMs: 5000,
    samplingIntervalMs: 1000,
    nodeMapping: [
      {
        nodeId: 'ns=3;s="Escritura"."REAL"',
        signalVariableName: 'Escritura_REAL',
        writable: true,
        dataType: 'Float',
        min: 0,
        max: 500,
      },
      {
        nodeId: 'ns=3;s="Escritura"."BOOL"',
        signalVariableName: 'Escritura_BOOL',
        writable: true,
        dataType: 'Boolean',
      },
      {
        nodeId: 'ns=3;s="Lectura"."REAL_1"',
        signalVariableName: 'Lectura_REAL_1',
        dataType: 'Float',
      },
    ],
  },
};

describe('WritePackageFormPage', () => {
  let machinesApi: { getConnection: ReturnType<typeof vi.fn> };
  let writePackagesApi: {
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    machinesApi = { getConnection: vi.fn().mockReturnValue(of(CONNECTION)) };
    writePackagesApi = {
      get: vi.fn(),
      create: vi.fn().mockReturnValue(of({ id: 'package-1' })),
      update: vi.fn().mockReturnValue(of({ id: 'package-1' })),
    };
  });

  async function renderPage(packageId: string | null = null) {
    const result = await render(WritePackageFormPage, {
      providers: [
        provideRouter([]),
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: WritePackagesApiService, useValue: writePackagesApi },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (key: string) => (key === 'machineId' ? 'machine-1' : packageId) },
            },
          },
        },
      ],
    });
    navigate = vi
      .spyOn(result.fixture.debugElement.injector.get(Router), 'navigate')
      .mockResolvedValue(true) as never;
    return result;
  }

  it('solo ofrece variables escribibles (criterio 2)', async () => {
    await renderPage();

    const options = screen.getAllByRole('option').map((option) => option.textContent?.trim());
    expect(options).toContain('Escritura_REAL (Float)');
    expect(options).toContain('Escritura_BOOL (Boolean)');
    expect(options.join(' ')).not.toContain('Lectura_REAL_1');
  });

  it('crea un paquete con un valor numérico y uno booleano', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Formato 120 mm');
    await user.type(screen.getByLabelText('Valor'), '120');
    await user.click(screen.getByRole('button', { name: 'Añadir variable' }));
    await user.selectOptions(screen.getAllByLabelText('Valor')[1], 'true');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(writePackagesApi.create).toHaveBeenCalledWith('machine-1', {
      name: 'Formato 120 mm',
      items: [
        { signalVariableName: 'Escritura_REAL', value: 120 },
        { signalVariableName: 'Escritura_BOOL', value: true },
      ],
    });
    expect(navigate).toHaveBeenCalledWith(['/config/machines', 'machine-1']);
  });

  it('valida los límites antes de enviar (criterio 2)', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Fuera de rango');
    await user.type(screen.getByLabelText('Valor'), '9999');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Máximo 500.')).toBeInTheDocument();
    expect(writePackagesApi.create).not.toHaveBeenCalled();
  });

  it('en edición precarga el paquete y guarda con PATCH', async () => {
    writePackagesApi.get.mockReturnValue(
      of({
        id: 'package-1',
        machineId: 'machine-1',
        name: 'Formato 120 mm',
        description: null,
        items: [{ signalVariableName: 'Escritura_REAL', value: 120 }],
      }),
    );
    const user = userEvent.setup();
    await renderPage('package-1');

    expect(screen.getByLabelText('Nombre')).toHaveValue('Formato 120 mm');
    expect(screen.getByLabelText('Valor')).toHaveValue(120);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(writePackagesApi.update).toHaveBeenCalledWith('machine-1', 'package-1', {
      name: 'Formato 120 mm',
      items: [{ signalVariableName: 'Escritura_REAL', value: 120 }],
    });
  });

  it('sin variables escribibles explica cómo marcarlas', async () => {
    machinesApi.getConnection.mockReturnValue(
      of({
        ...CONNECTION,
        providerType: 'Simulator',
        connectionConfig: { seedProfile: 'x', signals: [] },
      }),
    );

    await renderPage();

    expect(screen.getByText(/no tiene variables escribibles/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('muestra el error del Backend sin perder el formulario', async () => {
    writePackagesApi.create.mockReturnValue(
      throwError(() => ({ status: 409, code: 'WRITE_PACKAGE_NAME_TAKEN', message: '' })),
    );
    const user = userEvent.setup();
    await renderPage();

    await user.type(screen.getByLabelText('Nombre'), 'Repetido');
    await user.type(screen.getByLabelText('Valor'), '10');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Ya existe un paquete con ese nombre');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Repetido');
  });
});

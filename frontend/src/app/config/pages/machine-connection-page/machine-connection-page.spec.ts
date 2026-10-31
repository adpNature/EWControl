import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { MachineConnection, OpcUaBrowseNode } from '../../entities/machine-connection.model';
import { MachineConnectionPage } from './machine-connection-page';

const ENDPOINT = 'opc.tcp://192.168.1.1:4840';
const SIMULATOR_CONNECTION: MachineConnection = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: 'Simulator',
  connectionConfig: { seedProfile: 'demo', signals: [] },
};
const OPCUA_CONNECTION: MachineConnection = {
  id: 'connection-1',
  machineId: 'machine-1',
  providerType: 'OpcUa',
  connectionConfig: {
    endpointUrl: ENDPOINT,
    securityMode: 'None',
    securityPolicy: 'None',
    authMode: 'Anonymous',
    timeoutMs: 5000,
    samplingIntervalMs: 1000,
    nodeMapping: [{ nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' }],
  },
};
const LECTURA: OpcUaBrowseNode = {
  nodeId: 'ns=3;s="Lectura"',
  browseName: 'Lectura',
  displayName: 'Lectura',
  nodeClass: 'Object',
  hasChildren: true,
};
const ANCHO: OpcUaBrowseNode = {
  nodeId: 'ns=3;s="Lectura"."ARRAY_1"[0]."Ancho"',
  browseName: 'Ancho',
  displayName: 'Ancho',
  nodeClass: 'Variable',
  dataType: 'Float',
  hasChildren: false,
};

describe('MachineConnectionPage', () => {
  let machinesApi: {
    getConnection: ReturnType<typeof vi.fn>;
    replaceConnection: ReturnType<typeof vi.fn>;
    testOpcUaConnection: ReturnType<typeof vi.fn>;
    browseOpcUaNodes: ReturnType<typeof vi.fn>;
  };
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    machinesApi = {
      getConnection: vi.fn().mockReturnValue(of(SIMULATOR_CONNECTION)),
      replaceConnection: vi.fn((...args: unknown[]) =>
        of({ ...SIMULATOR_CONNECTION, ...(args[1] as Partial<MachineConnection>) }),
      ),
      testOpcUaConnection: vi.fn().mockReturnValue(of({ reachable: true })),
      browseOpcUaNodes: vi.fn((...args: unknown[]) => of({ nodes: args[2] ? [ANCHO] : [LECTURA] })),
    };
    toastService = { show: vi.fn() };
  });

  function renderPage() {
    return render(MachineConnectionPage, {
      providers: [
        provideHttpClient(),
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: ToastService, useValue: toastService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'machine-1' } } },
        },
      ],
    });
  }

  async function chooseOpcUaAndTypeEndpoint(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('radio', { name: 'OPC UA' }));
    await user.type(screen.getByLabelText('Endpoint (opc.tcp://host:puerto)'), ENDPOINT);
  }

  it('muestra el proveedor actual Simulador (criterio 1)', async () => {
    await renderPage();

    expect(machinesApi.getConnection).toHaveBeenCalledWith('machine-1');
    expect(screen.getByRole('radio', { name: 'Simulador' })).toBeChecked();
    expect(screen.queryByLabelText('Endpoint (opc.tcp://host:puerto)')).not.toBeInTheDocument();
  });

  it('muestra el endpoint y el mapeo de una Machine OPC UA (criterio 1)', async () => {
    machinesApi.getConnection.mockReturnValue(of(OPCUA_CONNECTION));

    await renderPage();

    expect(screen.getByRole('radio', { name: 'OPC UA' })).toBeChecked();
    expect(screen.getByLabelText('Endpoint (opc.tcp://host:puerto)')).toHaveValue(ENDPOINT);
    expect(screen.getByLabelText('Nombre de variable para ns=3;s="Lectura"."REAL_1"')).toHaveValue(
      'Lectura_REAL_1',
    );
  });

  it('"Probar conexión" muestra un toast de éxito o de error según el resultado (criterio 2)', async () => {
    const user = userEvent.setup();
    await renderPage();
    await chooseOpcUaAndTypeEndpoint(user);

    await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
    expect(machinesApi.testOpcUaConnection).toHaveBeenCalledWith('machine-1', ENDPOINT);
    expect(toastService.show).toHaveBeenLastCalledWith({
      type: 'success',
      message: 'Conexión establecida con el servidor OPC UA.',
    });

    machinesApi.testOpcUaConnection.mockReturnValue(of({ reachable: false, reason: 'TIMEOUT' }));
    await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
    expect(toastService.show).toHaveBeenLastCalledWith({
      type: 'danger',
      message: 'El servidor OPC UA no ha respondido a tiempo.',
    });
  });

  it('un endpoint sin opc.tcp:// se marca inválido sin llamar al backend (criterio 7)', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('radio', { name: 'OPC UA' }));
    await user.type(
      screen.getByLabelText('Endpoint (opc.tcp://host:puerto)'),
      'http://192.168.1.1',
    );

    await user.click(screen.getByRole('button', { name: 'Probar conexión' }));
    await user.click(screen.getByRole('button', { name: 'Explorar nodos' }));

    expect(screen.getByRole('alert')).toHaveTextContent('opc.tcp://host:puerto');
    expect(machinesApi.testOpcUaConnection).not.toHaveBeenCalled();
    expect(machinesApi.browseOpcUaNodes).not.toHaveBeenCalled();
  });

  it('explorar y añadir un nodo crea una fila con un nombre derivado de su ruta (criterios 4 y 5)', async () => {
    const user = userEvent.setup();
    await renderPage();
    await chooseOpcUaAndTypeEndpoint(user);

    await user.click(screen.getByRole('button', { name: 'Explorar nodos' }));
    await user.click(screen.getByRole('treeitem', { name: /Lectura/ }));
    await user.click(screen.getByRole('button', { name: 'Añadir al mapeo: Ancho' }));

    expect(screen.getByLabelText(`Nombre de variable para ${ANCHO.nodeId}`)).toHaveValue(
      'Lectura_ARRAY_1_0_Ancho',
    );
    expect(screen.getByRole('button', { name: 'Ya añadido: Ancho' })).toBeDisabled();
  });

  it('"Guardar" está deshabilitado con el mapeo vacío y con nombres no válidos (criterio 5)', async () => {
    machinesApi.getConnection.mockReturnValue(of(OPCUA_CONNECTION));
    const user = userEvent.setup();
    await renderPage();
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save).toBeEnabled();

    const nameInput = screen.getByLabelText('Nombre de variable para ns=3;s="Lectura"."REAL_1"');
    await user.clear(nameInput);
    await user.type(nameInput, '1velocidad');
    expect(save).toBeDisabled();
    expect(
      screen.getByText('Solo letras, números y _, sin empezar por número.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Quitar ns=3;s="Lectura"."REAL_1" del mapeo' }),
    );
    expect(save).toBeDisabled();
    expect(screen.getByText(/añade al menos una Variable/)).toBeInTheDocument();
  });

  it('cambiar de Simulador a OPC UA pide confirmación antes del PUT (criterio 6)', async () => {
    const user = userEvent.setup();
    await renderPage();
    await chooseOpcUaAndTypeEndpoint(user);
    await user.click(screen.getByRole('button', { name: 'Explorar nodos' }));
    await user.click(screen.getByRole('treeitem', { name: /Lectura/ }));
    await user.click(screen.getByRole('button', { name: 'Añadir al mapeo: Ancho' }));

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(machinesApi.replaceConnection).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('dejará de recibir datos simulados');

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(machinesApi.replaceConnection).toHaveBeenCalledWith('machine-1', {
      providerType: 'OpcUa',
      connectionConfig: {
        endpointUrl: ENDPOINT,
        securityMode: 'None',
        securityPolicy: 'None',
        authMode: 'Anonymous',
        timeoutMs: 5000,
        samplingIntervalMs: 1000,
        nodeMapping: [
          {
            nodeId: ANCHO.nodeId,
            signalVariableName: 'Lectura_ARRAY_1_0_Ancho',
            dataType: 'Float',
          },
        ],
      },
    });
    expect(toastService.show).toHaveBeenLastCalledWith({
      type: 'success',
      message: 'Conexión guardada.',
    });
  });

  it('guardar sin cambiar de proveedor no pide confirmación', async () => {
    machinesApi.getConnection.mockReturnValue(of(OPCUA_CONNECTION));
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(machinesApi.replaceConnection).toHaveBeenCalledTimes(1);
  });

  it('un error del backend al guardar se muestra en un toast', async () => {
    machinesApi.getConnection.mockReturnValue(of(OPCUA_CONNECTION));
    machinesApi.replaceConnection.mockReturnValue(
      throwError(() => ({ status: 422, code: 'OPCUA_ENDPOINT_NOT_ALLOWED', message: '' })),
    );
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(toastService.show).toHaveBeenLastCalledWith({
      type: 'danger',
      message: 'Este endpoint no está permitido por la configuración del servidor.',
    });
  });

  it('volver de OPC UA al Simulador pide confirmación y envía una config vacía del Simulador', async () => {
    machinesApi.getConnection.mockReturnValue(of(OPCUA_CONNECTION));
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('radio', { name: 'Simulador' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(machinesApi.replaceConnection).toHaveBeenCalledWith('machine-1', {
      providerType: 'Simulator',
      connectionConfig: { seedProfile: 'empty', signals: [] },
    });
  });

  describe('variables escribibles (docs/specs/20-paquetes-escritura-opc-ua.md, criterio frontend 1)', () => {
    const WRITABLE_CONNECTION: MachineConnection = {
      ...OPCUA_CONNECTION,
      connectionConfig: {
        endpointUrl: ENDPOINT,
        securityMode: 'None',
        securityPolicy: 'None',
        authMode: 'Anonymous',
        timeoutMs: 5000,
        samplingIntervalMs: 1000,
        nodeMapping: [
          {
            nodeId: 'ns=3;s="Escritura"."REAL"',
            signalVariableName: 'Escritura_REAL',
            dataType: 'Float',
          },
          { nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' },
        ],
      },
    };

    it('marca una variable como escribible con límites y los envía al guardar', async () => {
      machinesApi.getConnection.mockReturnValue(of(WRITABLE_CONNECTION));
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        screen.getByRole('checkbox', { name: 'Escribible: ns=3;s="Escritura"."REAL"' }),
      );
      await user.type(screen.getByLabelText('Mínimo para ns=3;s="Escritura"."REAL"'), '0');
      await user.type(screen.getByLabelText('Máximo para ns=3;s="Escritura"."REAL"'), '500');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(machinesApi.replaceConnection).toHaveBeenCalledWith(
        'machine-1',
        expect.objectContaining({
          connectionConfig: expect.objectContaining({
            nodeMapping: [
              {
                nodeId: 'ns=3;s="Escritura"."REAL"',
                signalVariableName: 'Escritura_REAL',
                dataType: 'Float',
                writable: true,
                min: 0,
                max: 500,
              },
              { nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' },
            ],
          }),
        }),
      );
    });

    it('no permite marcar como escribible una fila sin tipo conocido', async () => {
      machinesApi.getConnection.mockReturnValue(of(WRITABLE_CONNECTION));
      await renderPage();

      expect(
        screen.getByRole('checkbox', { name: 'Escribible: ns=3;s="Lectura"."REAL_1"' }),
      ).toBeDisabled();
    });

    it('bloquea el guardado si el mínimo supera al máximo', async () => {
      machinesApi.getConnection.mockReturnValue(of(WRITABLE_CONNECTION));
      const user = userEvent.setup();
      await renderPage();

      await user.click(
        screen.getByRole('checkbox', { name: 'Escribible: ns=3;s="Escritura"."REAL"' }),
      );
      await user.type(screen.getByLabelText('Mínimo para ns=3;s="Escritura"."REAL"'), '10');
      await user.type(screen.getByLabelText('Máximo para ns=3;s="Escritura"."REAL"'), '5');

      expect(screen.getByText('El mínimo no puede ser mayor que el máximo.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    it('al añadir un nodo explorado se guarda también su dataType', async () => {
      const user = userEvent.setup();
      await renderPage();
      await chooseOpcUaAndTypeEndpoint(user);
      await user.click(screen.getByRole('button', { name: 'Explorar nodos' }));
      await user.click(screen.getByRole('treeitem', { name: /Lectura/ }));
      await user.click(screen.getByRole('button', { name: 'Añadir al mapeo: Ancho' }));
      await user.click(screen.getByRole('button', { name: 'Guardar' }));
      await user.click(
        within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Guardar' }),
      );

      expect(machinesApi.replaceConnection).toHaveBeenCalledWith(
        'machine-1',
        expect.objectContaining({
          connectionConfig: expect.objectContaining({
            nodeMapping: [
              {
                nodeId: ANCHO.nodeId,
                signalVariableName: 'Lectura_ARRAY_1_0_Ancho',
                dataType: 'Float',
              },
            ],
          }),
        }),
      );
    });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import {
  MachineConnection,
  OpcUaVariableSyncResult,
} from '../../entities/machine-connection.model';
import { MachineOpcUaVariablesPage } from './machine-opcua-variables-page';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const ENDPOINT = 'opc.tcp://192.168.1.1:4840';

const CONNECTION: MachineConnection = {
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
    variableSyncRootNodeId: ROOT,
    nodeMapping: [
      { nodeId: `${ROOT}.iEstado`, signalVariableName: 'Estado', dataType: 'UInt16' },
      { nodeId: `${ROOT}.rVel`, signalVariableName: 'GVL_HMI_rVel', dataType: 'Float' },
      { nodeId: `${ROOT}.old`, signalVariableName: 'GVL_HMI_old', dataType: 'Boolean' },
      { nodeId: 'ns=2;s=Manual', signalVariableName: 'Manual' },
    ],
  },
};

const SYNC_RESULT: OpcUaVariableSyncResult = {
  rootNodeId: ROOT,
  syncedAt: '2026-11-07T10:00:00.000Z',
  summary: {
    total: 3,
    new: 1,
    unchanged: 1,
    typeChanged: 1,
    removed: 1,
    skipped: 1,
    byDataType: Object.fromEntries([
      ['Boolean', 1],
      ['Int16', 1],
      ['Float', 1],
    ]),
  },
  variables: [
    {
      nodeId: `${ROOT}.ax[0]`,
      path: ['GVL_HMI', 'ax', 'ax[0]'],
      dataType: 'Boolean',
      plcWritable: true,
      status: 'new',
      saved: null,
    },
    {
      nodeId: `${ROOT}.iEstado`,
      path: ['GVL_HMI', 'iEstado'],
      dataType: 'Int16',
      plcWritable: true,
      status: 'typeChanged',
      saved: { signalVariableName: 'Estado', label: null, dataType: 'UInt16' },
    },
    {
      nodeId: `${ROOT}.rVel`,
      path: ['GVL_HMI', 'rVel'],
      dataType: 'Float',
      plcWritable: false,
      status: 'unchanged',
      saved: { signalVariableName: 'GVL_HMI_rVel', label: 'Velocidad', dataType: 'Float' },
    },
  ],
  removed: [
    { nodeId: `${ROOT}.old`, signalVariableName: 'GVL_HMI_old', label: null, dataType: 'Boolean' },
  ],
  skipped: [
    {
      nodeId: `${ROOT}.ax`,
      path: ['GVL_HMI', 'ax'],
      dataType: 'Boolean',
      valueRank: 1,
      arrayDimensions: [2],
      reason: 'nonScalar',
    },
  ],
};

describe('MachineOpcUaVariablesPage (docs/specs/21-sincronizacion-variables-opc-ua.md)', () => {
  let machinesApi: {
    getConnection: ReturnType<typeof vi.fn>;
    syncOpcUaVariables: ReturnType<typeof vi.fn>;
    saveOpcUaVariables: ReturnType<typeof vi.fn>;
  };
  let toastService: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    machinesApi = {
      getConnection: vi.fn().mockReturnValue(of(CONNECTION)),
      syncOpcUaVariables: vi.fn().mockReturnValue(of(SYNC_RESULT)),
      saveOpcUaVariables: vi.fn().mockReturnValue(of(CONNECTION)),
    };
    toastService = { show: vi.fn() };
  });

  function renderPage() {
    return render(MachineOpcUaVariablesPage, {
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

  async function syncWith(user: ReturnType<typeof userEvent.setup>) {
    await renderPage();
    await user.click(screen.getByRole('button', { name: 'Sincronizar con OPC UA' }));
  }

  function rowOf(path: string): HTMLElement {
    return screen.getByRole('row', { name: new RegExp(path.replace(/[[\]]/g, '\\$&')) });
  }

  it('propone la carpeta guardada y no muestra «Guardar» antes de sincronizar', async () => {
    await renderPage();

    expect(screen.getByLabelText('Carpeta OPC UA (NodeId)')).toHaveValue(ROOT);
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  });

  it('sin carpeta, «Sincronizar con OPC UA» está deshabilitado', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.clear(screen.getByLabelText('Carpeta OPC UA (NodeId)'));

    expect(screen.getByRole('button', { name: 'Sincronizar con OPC UA' })).toBeDisabled();
  });

  it('sincroniza y muestra el resumen, el desglose por tipo y las filas (criterios 2 y 3)', async () => {
    const user = userEvent.setup();
    await syncWith(user);

    expect(machinesApi.syncOpcUaVariables).toHaveBeenCalledWith('machine-1', ROOT);
    const status = screen.getByRole('status', { name: 'Resumen de la sincronización' });
    expect(status).toHaveTextContent('1 nueva · 1 eliminada · 1 con tipo cambiado');
    expect(status).toHaveTextContent('3 variables · 1 omitida');
    expect(status).toHaveTextContent('BOOL 1 · INT 1 · REAL 1');

    const changed = rowOf('iEstado');
    expect(within(changed).getByText('Tipo cambiado')).toBeInTheDocument();
    expect(within(changed).getByText('UINT → INT')).toBeInTheDocument();
    expect(within(changed).getByText('UInt16 → Int16')).toBeInTheDocument();
    expect(within(changed).getByLabelText('Identificador de iEstado')).toHaveValue('Estado');

    const fresh = rowOf('ax[0]');
    expect(within(fresh).getByText('Nueva')).toBeInTheDocument();
    expect(within(fresh).getByLabelText('Identificador de ax[0]')).toHaveValue('GVL_HMI_ax_0');

    const saved = rowOf('rVel');
    expect(within(saved).getByText('Guardada')).toBeInTheDocument();
    expect(within(saved).getByText('REAL')).toBeInTheDocument();
    expect(within(saved).getByText('No')).toBeInTheDocument();
    expect(within(saved).getByLabelText('Etiqueta de rVel')).toHaveValue('Velocidad');
  });

  it('filtra por estado, tipo y texto sin perder lo editado (criterio 4)', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    await user.type(screen.getByLabelText('Etiqueta de ax[0]'), 'Avance manual');

    await user.selectOptions(screen.getByLabelText('Estado'), 'typeChanged');
    expect(screen.queryByLabelText('Etiqueta de ax[0]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Identificador de iEstado')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Estado'), 'all');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Float');
    expect(screen.getAllByRole('textbox', { name: /^Identificador de/ })).toHaveLength(1);

    await user.selectOptions(screen.getByLabelText('Tipo'), '');
    await user.type(screen.getByLabelText('Buscar'), 'avance');
    expect(screen.getByLabelText('Etiqueta de ax[0]')).toHaveValue('Avance manual');
    expect(screen.getAllByRole('textbox', { name: /^Identificador de/ })).toHaveLength(1);
  });

  it('el filtro de tipo ofrece los tipos presentes con su recuento', async () => {
    const user = userEvent.setup();
    await syncWith(user);

    const options = within(screen.getByLabelText('Tipo')).getAllByRole('option');
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Todos',
      'BOOL (1)',
      'INT (1)',
      'REAL (1)',
    ]);
  });

  it('muestra las eliminadas con su casilla desmarcada y las omitidas con su motivo (criterio 5)', async () => {
    const user = userEvent.setup();
    await syncWith(user);

    const removed = screen.getByRole('region', { name: 'Eliminadas en el PLC' });
    expect(within(removed).getByText('GVL_HMI_old')).toBeInTheDocument();
    expect(
      within(removed).getByRole('checkbox', { name: 'Quitar GVL_HMI_old del mapeo' }),
    ).not.toBeChecked();

    expect(screen.getByText('Omitidas (1)')).toBeInTheDocument();
    expect(screen.getByText('Array de BOOL [2]')).toBeInTheDocument();
  });

  it('guardar pide confirmación y envía variables y las eliminadas marcadas (criterio 6)', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    await user.type(screen.getByLabelText('Etiqueta de ax[0]'), 'Avance manual');
    await user.click(screen.getByRole('checkbox', { name: 'Quitar GVL_HMI_old del mapeo' }));

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Se guardarán 3 variables en la Machine y se reiniciará su lectura en tiempo real. Se quitarán 1.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(machinesApi.saveOpcUaVariables).toHaveBeenCalledWith('machine-1', {
      rootNodeId: ROOT,
      variables: [
        {
          nodeId: `${ROOT}.ax[0]`,
          signalVariableName: 'GVL_HMI_ax_0',
          label: 'Avance manual',
          dataType: 'Boolean',
        },
        { nodeId: `${ROOT}.iEstado`, signalVariableName: 'Estado', label: null, dataType: 'Int16' },
        {
          nodeId: `${ROOT}.rVel`,
          signalVariableName: 'GVL_HMI_rVel',
          label: 'Velocidad',
          dataType: 'Float',
        },
      ],
      remove: [`${ROOT}.old`],
    });
    expect(toastService.show).toHaveBeenCalledWith({
      type: 'success',
      message: 'Variables guardadas.',
    });
    expect(screen.getByRole('status', { name: 'Resumen de la sincronización' })).toHaveTextContent(
      'Sin cambios respecto a lo guardado',
    );
    expect(screen.queryByText('Nueva')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Eliminadas en el PLC' })).not.toBeInTheDocument();
  });

  it('cancelar la confirmación no envía nada', async () => {
    const user = userEvent.setup();
    await syncWith(user);

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }),
    );

    expect(machinesApi.saveOpcUaVariables).not.toHaveBeenCalled();
  });

  it('identificadores inválidos o repetidos con otros mapeos bloquean el guardado y vuelven a «Todas»', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    const identifier = screen.getByLabelText('Identificador de ax[0]');
    await user.clear(identifier);
    await user.type(identifier, 'Manual');
    await user.selectOptions(screen.getByLabelText('Estado'), 'typeChanged');

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toHaveValue('all');
    expect(screen.getByLabelText('Identificador de ax[0]')).toHaveAccessibleDescription(
      'Identificador repetido.',
    );
    expect(machinesApi.saveOpcUaVariables).not.toHaveBeenCalled();
  });

  it('un error al sincronizar se muestra como alerta y conserva el listado (criterio 7)', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    machinesApi.syncOpcUaVariables.mockReturnValue(
      throwError(() => ({ status: 504, code: 'OPCUA_SYNC_TIMEOUT', message: '' })),
    );

    await user.click(screen.getByRole('button', { name: 'Sincronizar con OPC UA' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'La máquina ha tardado demasiado en responder.',
    );
    expect(screen.getByLabelText('Identificador de iEstado')).toBeInTheDocument();
  });

  it('un 409 OPCUA_VARIABLE_IN_USE marca las filas afectadas con sus usos (criterio 7)', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    machinesApi.saveOpcUaVariables.mockReturnValue(
      throwError(() => ({
        status: 409,
        code: 'OPCUA_VARIABLE_IN_USE',
        message: '',
        details: {
          variables: [
            {
              signalVariableName: 'Estado',
              usedBy: [{ kind: 'Signal', id: 's-1', name: 'Estado máquina' }],
            },
          ],
        },
      })),
    );
    const identifier = screen.getByLabelText('Identificador de iEstado');
    await user.clear(identifier);
    await user.type(identifier, 'EstadoMaquina');

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(
      within(rowOf('iEstado')).getByText('Se usa en: Signal "Estado máquina"'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hay variables en uso que no se pueden renombrar ni quitar.',
    );
    expect(screen.getByLabelText('Identificador de iEstado')).toHaveValue('EstadoMaquina');
  });

  it('un 422 OPCUA_MAPPING_LIMIT explica el máximo', async () => {
    const user = userEvent.setup();
    await syncWith(user);
    machinesApi.saveOpcUaVariables.mockReturnValue(
      throwError(() => ({
        status: 422,
        code: 'OPCUA_MAPPING_LIMIT',
        message: '',
        details: { resultingEntries: 503, maxEntries: 500 },
      })),
    );

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Guardar' }),
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'El mapeo superaría el máximo de 500 variables (503).',
    );
  });
});

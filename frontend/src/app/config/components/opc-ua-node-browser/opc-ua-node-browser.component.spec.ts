import { provideHttpClient } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { OpcUaBrowseNode } from '../../entities/machine-connection.model';
import { OpcUaNodeBrowserComponent } from './opc-ua-node-browser.component';

const ENDPOINT = 'opc.tcp://192.168.1.1:4840';
const LECTURA: OpcUaBrowseNode = {
  nodeId: 'ns=3;s="Lectura"',
  browseName: 'Lectura',
  displayName: 'Lectura',
  nodeClass: 'Object',
  hasChildren: true,
};
const REAL_1: OpcUaBrowseNode = {
  nodeId: 'ns=3;s="Lectura"."REAL_1"',
  browseName: 'REAL_1',
  displayName: 'REAL_1',
  nodeClass: 'Variable',
  dataType: 'Float',
  hasChildren: false,
};
const ARRAY_1: OpcUaBrowseNode = {
  nodeId: 'ns=3;s="Lectura"."ARRAY_1"',
  browseName: 'ARRAY_1',
  displayName: 'ARRAY_1',
  nodeClass: 'Variable',
  dataType: 'ExtensionObject',
  hasChildren: true,
};

describe('OpcUaNodeBrowserComponent', () => {
  let machinesApi: { browseOpcUaNodes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    machinesApi = {
      browseOpcUaNodes: vi.fn((...args: unknown[]) =>
        of({ nodes: args[2] ? [REAL_1, ARRAY_1] : [LECTURA] }),
      ),
    };
  });

  async function renderBrowser(mappedNodeIds: ReadonlySet<string> = new Set()) {
    const nodeAdded = vi.fn();
    const result = await render(OpcUaNodeBrowserComponent, {
      inputs: { machineId: 'machine-1', endpointUrl: ENDPOINT, mappedNodeIds },
      on: { nodeAdded },
      providers: [provideHttpClient(), { provide: MachinesApiService, useValue: machinesApi }],
    });
    return { ...result, nodeAdded };
  }

  it('carga solo los hijos de ObjectsFolder al iniciarse (criterio 3)', async () => {
    await renderBrowser();

    expect(machinesApi.browseOpcUaNodes).toHaveBeenCalledTimes(1);
    expect(machinesApi.browseOpcUaNodes).toHaveBeenCalledWith('machine-1', ENDPOINT);
    const tree = screen.getByRole('tree', { name: 'Nodos del servidor OPC UA' });
    const item = within(tree).getByRole('treeitem', { name: /Lectura/ });
    expect(item).toHaveAttribute('aria-expanded', 'false');
    expect(item).toHaveAttribute('aria-level', '1');
  });

  it('pide los hijos de un nodo solo al expandirlo, y no los vuelve a pedir', async () => {
    const user = userEvent.setup();
    await renderBrowser();
    const lectura = screen.getByRole('treeitem', { name: /Lectura/ });

    await user.click(lectura);

    expect(machinesApi.browseOpcUaNodes).toHaveBeenLastCalledWith(
      'machine-1',
      ENDPOINT,
      LECTURA.nodeId,
    );
    expect(lectura).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('treeitem', { name: /REAL_1/ })).toHaveAttribute('aria-level', '2');

    await user.click(lectura);
    await user.click(lectura);
    expect(machinesApi.browseOpcUaNodes).toHaveBeenCalledTimes(2);
  });

  it('solo ofrece "Añadir" en Variables escalares, no en structs/arrays (criterio 4)', async () => {
    const user = userEvent.setup();
    const { nodeAdded } = await renderBrowser();
    await user.click(screen.getByRole('treeitem', { name: /Lectura/ }));

    const arrayItem = screen.getByRole('treeitem', { name: /ARRAY_1/ });
    expect(within(arrayItem).queryByRole('button')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Añadir al mapeo: REAL_1' }));
    expect(nodeAdded).toHaveBeenCalledWith(REAL_1);
  });

  it('deshabilita "Añadir" en un nodo ya mapeado', async () => {
    const user = userEvent.setup();
    await renderBrowser(new Set([REAL_1.nodeId]));
    await user.click(screen.getByRole('treeitem', { name: /Lectura/ }));

    expect(screen.getByRole('button', { name: 'Ya añadido: REAL_1' })).toBeDisabled();
  });

  it('se navega con el teclado: flechas para moverse/expandir, Enter para añadir una Variable', async () => {
    const user = userEvent.setup();
    const { nodeAdded } = await renderBrowser();
    const lectura = screen.getByRole('treeitem', { name: /Lectura/ });
    expect(lectura).toHaveAttribute('tabindex', '0');

    lectura.focus();
    await user.keyboard('{ArrowRight}');
    expect(lectura).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowRight}');
    const real = screen.getByRole('treeitem', { name: /REAL_1/ });
    expect(real).toHaveAttribute('tabindex', '0');
    expect(lectura).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{Enter}');
    expect(nodeAdded).toHaveBeenCalledWith(REAL_1);

    await user.keyboard('{ArrowLeft}');
    expect(lectura).toHaveAttribute('tabindex', '0');
    await user.keyboard('{ArrowLeft}');
    expect(lectura).toHaveAttribute('aria-expanded', 'false');
  });

  it('muestra el error de la raíz sin árbol si el endpoint no responde', async () => {
    machinesApi.browseOpcUaNodes.mockReturnValue(
      throwError(() => ({ status: 502, code: 'OPCUA_ENDPOINT_UNREACHABLE', message: '' })),
    );

    await renderBrowser();

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido conectar');
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('un fallo al expandir muestra el error en ese nodo sin perder los ya cargados', async () => {
    const user = userEvent.setup();
    await renderBrowser();
    machinesApi.browseOpcUaNodes.mockReturnValue(
      throwError(() => ({ status: 422, code: 'OPCUA_ENDPOINT_NOT_ALLOWED', message: '' })),
    );

    const lectura = screen.getByRole('treeitem', { name: /Lectura/ });
    await user.click(lectura);

    expect(within(lectura).getByRole('alert')).toHaveTextContent('no está permitido');
    expect(lectura).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });
});

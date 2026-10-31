import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { WritePackagesApiService } from '../../adapters/write-packages-api.service';
import { WritePackage, WritePackageList } from '../../entities/write-package.model';
import { WritePackagesPage } from './write-packages-page';

const MACHINES = [
  { id: 'machine-sim', companyId: 'company-1', name: 'Simulada', providerType: 'Simulator' },
  { id: 'machine-1', companyId: 'company-1', name: 'Piloto OPC UA', providerType: 'OpcUa' },
];
const PACKAGE: WritePackage = {
  id: 'package-1',
  machineId: 'machine-1',
  name: 'Formato 120 mm',
  description: 'Cambio de formato',
  items: [{ signalVariableName: 'Escritura_REAL', value: 120 }],
  isActive: true,
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
};

function listOf(overrides: Partial<WritePackageList> = {}): WritePackageList {
  return { providerType: 'OpcUa', connected: true, packages: [PACKAGE], ...overrides };
}

describe('WritePackagesPage', () => {
  let writePackagesApi: {
    list: ReturnType<typeof vi.fn>;
    executions: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    writePackagesApi = {
      list: vi.fn().mockReturnValue(of(listOf())),
      executions: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'execution-1',
              packageId: 'package-1',
              machineId: 'machine-1',
              userEmail: 'operador@ewcontrol.local',
              executedAt: '2026-10-30T12:00:00Z',
              status: 'FAILED',
              reason: 'MACHINE_NOT_CONNECTED',
              items: [
                {
                  signalVariableName: 'Escritura_REAL',
                  nodeId: null,
                  value: 120,
                  statusCode: 'NOT_SENT',
                },
              ],
            },
          ],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
      execute: vi.fn(),
    };
  });

  function renderPage() {
    return render(WritePackagesPage, {
      providers: [
        {
          provide: MachinesApiService,
          useValue: { list: vi.fn().mockReturnValue(of({ data: MACHINES, total: 2 })) },
        },
        { provide: WritePackagesApiService, useValue: writePackagesApi },
      ],
    });
  }

  it('preselecciona la primera Machine OPC UA y muestra sus paquetes con sus valores', async () => {
    await renderPage();

    expect(writePackagesApi.list).toHaveBeenCalledWith('machine-1');
    expect(screen.getByLabelText('Machine')).toHaveValue('machine-1');
    expect(screen.getByRole('heading', { name: 'Formato 120 mm' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Valores de Formato 120 mm' })).toHaveTextContent(
      'Escritura_REAL = 120',
    );
    expect(screen.getByRole('button', { name: 'Ejecutar' })).toBeEnabled();
  });

  it('con la Machine desconectada, "Ejecutar" está deshabilitado con el motivo (criterio 6)', async () => {
    writePackagesApi.list.mockReturnValue(of(listOf({ connected: false })));

    await renderPage();

    expect(screen.getByRole('button', { name: 'Ejecutar' })).toBeDisabled();
    expect(screen.getByText('La Machine no está conectada a su PLC.')).toBeInTheDocument();
  });

  it('en una Machine del Simulador explica que no admite escritura (criterio 6)', async () => {
    writePackagesApi.list.mockReturnValue(of(listOf({ providerType: 'Simulator' })));
    const user = userEvent.setup();
    await renderPage();

    await user.selectOptions(screen.getByLabelText('Machine'), 'machine-sim');

    expect(writePackagesApi.list).toHaveBeenLastCalledWith('machine-sim');
    expect(screen.getByText(/no admite escritura/)).toBeInTheDocument();
  });

  it('muestra el historial con quién, cuándo y el resultado por variable (criterio 7)', async () => {
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole('button', { name: 'Historial' }));

    expect(writePackagesApi.executions).toHaveBeenCalledWith('machine-1', 'package-1', {
      limit: 10,
      offset: 0,
    });
    const table = screen.getByRole('table', { name: 'Historial de Formato 120 mm' });
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('operador@ewcontrol.local');
    expect(row).toHaveTextContent('No se ha escrito');
    expect(row).toHaveTextContent('no está conectada');
    expect(row).toHaveTextContent('Escritura_REAL = 120 → No enviado');
  });

  it('no muestra controles de crear ni editar paquetes (criterio 5)', async () => {
    await renderPage();

    expect(screen.queryByRole('button', { name: /Nuevo|Editar|Eliminar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Nuevo|Editar/ })).not.toBeInTheDocument();
  });
});

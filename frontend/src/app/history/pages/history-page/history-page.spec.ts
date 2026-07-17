import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { CompaniesState } from '../../../config/use-cases/companies.state';
import { SelectedCompanyState } from '../../../config/use-cases/selected-company.state';
import { HistoryComparisonState } from '../../use-cases/history-comparison.state';
import { HistoryPage } from './history-page';

const ADMIN_USER = {
  id: 'user-1',
  email: 'admin@ewcontrol.local',
  role: 'AdminCliente',
  companyId: 'company-1',
};
const SUPERADMIN_USER = {
  id: 'user-2',
  email: 'super@ewcontrol.local',
  role: 'SuperAdmin',
  companyId: '',
};

function createAuthState(currentUser: unknown) {
  return { currentUser: () => currentUser } as unknown as AuthStateService;
}

function createHistoryState(overrides: Record<string, unknown> = {}) {
  return {
    selectedSignalIds: () => [],
    comparison: () => null,
    loading: () => false,
    error: () => false,
    setSelectedSignalIds: vi.fn(),
    loadComparison: vi.fn().mockReturnValue(of({ resolution: 'raw', series: [] })),
    clearSelection: vi.fn(),
    ...overrides,
  } as unknown as HistoryComparisonState;
}

function createSelectedCompanyState(selectedCompanyId: string | null = null) {
  return {
    selectedCompanyId: () => selectedCompanyId,
    select: vi.fn(),
    clear: vi.fn(),
  } as unknown as SelectedCompanyState;
}

function createCompaniesState() {
  return {
    companies: () => [{ id: 'company-1', name: 'Demo Company', isActive: true }],
    loading: () => false,
    load: vi.fn().mockReturnValue(of([])),
  } as unknown as CompaniesState;
}

const NO_SIGNALS_PROVIDERS = [
  { provide: MachinesApiService, useValue: { list: vi.fn().mockReturnValue(of({ data: [] })) } },
  { provide: SignalsApiService, useValue: { list: vi.fn() } },
];

describe('HistoryPage', () => {
  it('un AdminCliente nunca ve el selector de Company', async () => {
    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: createHistoryState() },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.queryByLabelText('Company')).not.toBeInTheDocument();
  });

  it('un SuperAdmin sin Company elegida no ve el picker de Signals', async () => {
    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(SUPERADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState(null) },
        { provide: HistoryComparisonState, useValue: createHistoryState() },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.getByLabelText('Company')).toBeInTheDocument();
    expect(screen.getByText('Selecciona una Company para continuar.')).toBeInTheDocument();
  });

  it('un SuperAdmin con Company elegida ve el picker acotado a esa Company', async () => {
    const machinesApi = { list: vi.fn().mockReturnValue(of({ data: [] })) };

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(SUPERADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState('company-1') },
        { provide: HistoryComparisonState, useValue: createHistoryState() },
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: SignalsApiService, useValue: { list: vi.fn() } },
      ],
    });

    expect(machinesApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1' }),
    );
  });

  it('cambiar de Company limpia la selección ya hecha', async () => {
    const selectedCompanyState = createSelectedCompanyState(null);
    const historyState = createHistoryState();

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(SUPERADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: selectedCompanyState },
        { provide: HistoryComparisonState, useValue: historyState },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    await userEvent.selectOptions(screen.getByLabelText('Company'), 'company-1');

    expect(selectedCompanyState.select).toHaveBeenCalledWith('company-1');
    expect(historyState.clearSelection).toHaveBeenCalled();
  });

  it('el botón Comparar está deshabilitado sin ninguna Signal seleccionada', async () => {
    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: createHistoryState() },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeDisabled();
  });

  it('con Signals seleccionadas, pulsar Comparar llama a loadComparison', async () => {
    const historyState = createHistoryState({ selectedSignalIds: () => ['signal-1'] });

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: historyState },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Comparar' }));

    expect(historyState.loadComparison).toHaveBeenCalled();
  });

  it('mientras carga la comparativa, muestra un estado de carga en vez del gráfico', async () => {
    const historyState = createHistoryState({ loading: () => true });

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: historyState },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.getByText('Cargando comparativa…')).toBeInTheDocument();
  });

  it('el botón Comparar se deshabilita mientras ya hay una carga en curso', async () => {
    const historyState = createHistoryState({
      selectedSignalIds: () => ['signal-1'],
      loading: () => true,
    });

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: historyState },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.getByRole('button', { name: 'Comparar' })).toBeDisabled();
  });

  it('un fallo al cargar la comparativa muestra un estado de error con reintentar', async () => {
    const historyState = createHistoryState({ error: () => true });

    await render(HistoryPage, {
      providers: [
        { provide: AuthStateService, useValue: createAuthState(ADMIN_USER) },
        { provide: CompaniesState, useValue: createCompaniesState() },
        { provide: SelectedCompanyState, useValue: createSelectedCompanyState() },
        { provide: HistoryComparisonState, useValue: historyState },
        ...NO_SIGNALS_PROVIDERS,
      ],
    });

    expect(screen.getByText('No se ha podido cargar la comparativa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

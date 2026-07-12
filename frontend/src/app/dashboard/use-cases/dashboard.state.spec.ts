import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DashboardApiService } from '../adapters/dashboard-api.service';
import { Dashboard, DashboardDetail, DashboardWidget } from '../entities/dashboard.model';
import { DashboardState } from './dashboard.state';

const DASHBOARD_1: Dashboard = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };
const WIDGET_1: DashboardWidget = {
  id: 'widget-1',
  widgetType: 'VALUE',
  widgetConfig: {},
  position: 0,
  signals: [{ id: 'signal-1', name: 'Temperatura', unit: '°C', machineId: 'machine-1' }],
};
const DETAIL_1: DashboardDetail = { ...DASHBOARD_1, widgets: [] };

describe('DashboardState', () => {
  let service: DashboardState;
  let dashboardApi: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    createWidget: ReturnType<typeof vi.fn>;
    updateWidget: ReturnType<typeof vi.fn>;
    removeWidget: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    dashboardApi = {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      createWidget: vi.fn(),
      updateWidget: vi.fn(),
      removeWidget: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: DashboardApiService, useValue: dashboardApi }],
    });
    service = TestBed.inject(DashboardState);
  });

  it('loadDashboards() sincroniza el signal dashboards con la respuesta', async () => {
    dashboardApi.list.mockReturnValue(of({ data: [DASHBOARD_1], total: 1, limit: 20, offset: 0 }));

    await new Promise((resolve, reject) =>
      service.loadDashboards().subscribe({ next: resolve, error: reject }),
    );

    expect(service.dashboards()).toEqual([DASHBOARD_1]);
    expect(service.loading()).toBe(false);
  });

  it('loadDashboards() en fallo apaga loading sin romper', async () => {
    dashboardApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.loadDashboards().subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('createDashboard() añade el Dashboard creado al signal dashboards', async () => {
    dashboardApi.create.mockReturnValue(of(DASHBOARD_1));

    await new Promise((resolve, reject) =>
      service.createDashboard({ name: 'Planta 1' }).subscribe({ next: resolve, error: reject }),
    );

    expect(service.dashboards()).toEqual([DASHBOARD_1]);
  });

  it('open() carga el Dashboard activo con sus widgets', async () => {
    dashboardApi.get.mockReturnValue(of(DETAIL_1));

    await new Promise((resolve, reject) =>
      service.open('dashboard-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.activeDashboard()).toEqual(DETAIL_1);
  });

  it('addWidget() añade el widget creado al Dashboard activo', async () => {
    dashboardApi.get.mockReturnValue(of(DETAIL_1));
    await new Promise((resolve, reject) =>
      service.open('dashboard-1').subscribe({ next: resolve, error: reject }),
    );
    dashboardApi.createWidget.mockReturnValue(of(WIDGET_1));

    await new Promise((resolve, reject) =>
      service
        .addWidget('dashboard-1', { widgetType: 'VALUE', signalIds: ['signal-1'], config: {} })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.activeDashboard()?.widgets).toEqual([WIDGET_1]);
  });

  it('updateWidget() reemplaza el widget actualizado en el Dashboard activo', async () => {
    dashboardApi.get.mockReturnValue(of({ ...DETAIL_1, widgets: [WIDGET_1] }));
    await new Promise((resolve, reject) =>
      service.open('dashboard-1').subscribe({ next: resolve, error: reject }),
    );
    const updated = { ...WIDGET_1, position: 3 };
    dashboardApi.updateWidget.mockReturnValue(of(updated));

    await new Promise((resolve, reject) =>
      service
        .updateWidget('dashboard-1', 'widget-1', { position: 3 })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.activeDashboard()?.widgets).toEqual([updated]);
  });

  it('addWidget()/updateWidget()/removeWidget() no tocan el signal si no hay Dashboard activo o es otro', async () => {
    dashboardApi.createWidget.mockReturnValue(of(WIDGET_1));
    dashboardApi.updateWidget.mockReturnValue(of(WIDGET_1));
    dashboardApi.removeWidget.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service
        .addWidget('other-dashboard', { widgetType: 'VALUE', signalIds: ['signal-1'], config: {} })
        .subscribe({ next: resolve, error: reject }),
    );
    await new Promise((resolve, reject) =>
      service
        .updateWidget('other-dashboard', 'widget-1', { position: 1 })
        .subscribe({ next: resolve, error: reject }),
    );
    await new Promise((resolve, reject) =>
      service
        .removeWidget('other-dashboard', 'widget-1')
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.activeDashboard()).toBeNull();
  });

  it('removeWidget() retira el widget del Dashboard activo', async () => {
    dashboardApi.get.mockReturnValue(of({ ...DETAIL_1, widgets: [WIDGET_1] }));
    await new Promise((resolve, reject) =>
      service.open('dashboard-1').subscribe({ next: resolve, error: reject }),
    );
    dashboardApi.removeWidget.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.removeWidget('dashboard-1', 'widget-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.activeDashboard()?.widgets).toEqual([]);
  });
});

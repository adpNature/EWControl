import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { DashboardApiService } from '../adapters/dashboard-api.service';
import {
  CreateDashboardRequest,
  CreateWidgetRequest,
  Dashboard,
  DashboardDetail,
  DashboardWidget,
  UpdateWidgetRequest,
} from '../entities/dashboard.model';

const DEFAULT_LIMIT = 20;

/**
 * Use Case de la feature `dashboard/` (docs/specs/07-dashboard-tiempo-real.md):
 * estado del Dashboard activo y su lista, mismo patrón signal+tap que
 * `config/use-cases/machines.state.ts`.
 */
@Injectable({ providedIn: 'root' })
export class DashboardState {
  private readonly dashboardApi = inject(DashboardApiService);

  private readonly dashboardsSignal = signal<Dashboard[]>([]);
  private readonly activeDashboardSignal = signal<DashboardDetail | null>(null);
  private readonly loadingSignal = signal(false);

  readonly dashboards = this.dashboardsSignal.asReadonly();
  readonly activeDashboard = this.activeDashboardSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  loadDashboards(): Observable<Dashboard[]> {
    this.loadingSignal.set(true);
    return this.dashboardApi.list({ limit: DEFAULT_LIMIT, offset: 0 }).pipe(
      tap({
        next: (response) => {
          this.dashboardsSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  createDashboard(request: CreateDashboardRequest): Observable<Dashboard> {
    return this.dashboardApi
      .create(request)
      .pipe(tap((dashboard) => this.dashboardsSignal.update((current) => [...current, dashboard])));
  }

  open(dashboardId: string): Observable<DashboardDetail> {
    this.loadingSignal.set(true);
    return this.dashboardApi.get(dashboardId).pipe(
      tap({
        next: (detail) => {
          this.activeDashboardSignal.set(detail);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
    );
  }

  addWidget(dashboardId: string, request: CreateWidgetRequest): Observable<DashboardWidget> {
    return this.dashboardApi
      .createWidget(dashboardId, request)
      .pipe(tap((widget) => this.appendWidget(dashboardId, widget)));
  }

  updateWidget(
    dashboardId: string,
    widgetId: string,
    request: UpdateWidgetRequest,
  ): Observable<DashboardWidget> {
    return this.dashboardApi
      .updateWidget(dashboardId, widgetId, request)
      .pipe(tap((widget) => this.replaceWidget(dashboardId, widget)));
  }

  removeWidget(dashboardId: string, widgetId: string): Observable<void> {
    return this.dashboardApi
      .removeWidget(dashboardId, widgetId)
      .pipe(tap(() => this.dropWidget(dashboardId, widgetId)));
  }

  private appendWidget(dashboardId: string, widget: DashboardWidget): void {
    this.activeDashboardSignal.update((current) =>
      current && current.id === dashboardId
        ? { ...current, widgets: [...current.widgets, widget] }
        : current,
    );
  }

  private replaceWidget(dashboardId: string, widget: DashboardWidget): void {
    this.activeDashboardSignal.update((current) =>
      current && current.id === dashboardId
        ? {
            ...current,
            widgets: current.widgets.map((w) => (w.id === widget.id ? widget : w)),
          }
        : current,
    );
  }

  private dropWidget(dashboardId: string, widgetId: string): void {
    this.activeDashboardSignal.update((current) =>
      current && current.id === dashboardId
        ? { ...current, widgets: current.widgets.filter((w) => w.id !== widgetId) }
        : current,
    );
  }
}

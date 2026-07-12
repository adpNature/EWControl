import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import {
  CreateDashboardRequest,
  CreateWidgetRequest,
  Dashboard,
  DashboardDetail,
  DashboardWidget,
  UpdateWidgetRequest,
} from '../entities/dashboard.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "Dashboard / DashboardWidget". */
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly api = inject(ApiService);

  list(params: { limit: number; offset: number }): Observable<PaginatedResponse<Dashboard>> {
    return this.api.get<PaginatedResponse<Dashboard>>('/dashboards', params);
  }

  get(id: string): Observable<DashboardDetail> {
    return this.api.get<DashboardDetail>(`/dashboards/${id}`);
  }

  create(request: CreateDashboardRequest): Observable<Dashboard> {
    return this.api.post<Dashboard>('/dashboards', request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/dashboards/${id}`);
  }

  createWidget(dashboardId: string, request: CreateWidgetRequest): Observable<DashboardWidget> {
    return this.api.post<DashboardWidget>(`/dashboards/${dashboardId}/widgets`, request);
  }

  updateWidget(
    dashboardId: string,
    widgetId: string,
    request: UpdateWidgetRequest,
  ): Observable<DashboardWidget> {
    return this.api.patch<DashboardWidget>(
      `/dashboards/${dashboardId}/widgets/${widgetId}`,
      request,
    );
  }

  removeWidget(dashboardId: string, widgetId: string): Observable<void> {
    return this.api.delete<void>(`/dashboards/${dashboardId}/widgets/${widgetId}`);
  }
}

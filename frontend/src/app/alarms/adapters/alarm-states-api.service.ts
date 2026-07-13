import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { AlarmState, AlarmStateDetail, AlarmStateFilters } from '../entities/alarm-state.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "AlarmState" (solo lectura). */
@Injectable({ providedIn: 'root' })
export class AlarmStatesApiService {
  private readonly api = inject(ApiService);

  list(
    filters: AlarmStateFilters,
    pagination: { limit: number; offset: number },
  ): Observable<PaginatedResponse<AlarmState>> {
    const params: Record<string, string | number> = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (filters.status) {
      params['status'] = filters.status;
    }
    if (filters.machineId) {
      params['machineId'] = filters.machineId;
    }
    if (filters.priority) {
      params['priority'] = filters.priority;
    }
    return this.api.get<PaginatedResponse<AlarmState>>('/alarm-states', params);
  }

  get(id: string): Observable<AlarmStateDetail> {
    return this.api.get<AlarmStateDetail>(`/alarm-states/${id}`);
  }
}

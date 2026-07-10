import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { CreateSignalRequest, Signal, UpdateSignalRequest } from '../entities/signal.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "Signal". */
@Injectable({ providedIn: 'root' })
export class SignalsApiService {
  private readonly api = inject(ApiService);

  list(
    machineId: string,
    params: { limit: number; offset: number },
  ): Observable<PaginatedResponse<Signal>> {
    return this.api.get<PaginatedResponse<Signal>>(`/machines/${machineId}/signals`, params);
  }

  get(machineId: string, id: string): Observable<Signal> {
    return this.api.get<Signal>(`/machines/${machineId}/signals/${id}`);
  }

  create(machineId: string, request: CreateSignalRequest): Observable<Signal> {
    return this.api.post<Signal>(`/machines/${machineId}/signals`, request);
  }

  update(machineId: string, id: string, request: UpdateSignalRequest): Observable<Signal> {
    return this.api.patch<Signal>(`/machines/${machineId}/signals/${id}`, request);
  }

  remove(machineId: string, id: string): Observable<void> {
    return this.api.delete<void>(`/machines/${machineId}/signals/${id}`);
  }
}

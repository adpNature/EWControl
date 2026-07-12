import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { SignalHistoryResponse, SignalValue } from '../../core/websocket/realtime-events.model';
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

  /** docs/specs/07-dashboard-tiempo-real.md: valor actual desde la Realtime Cache. */
  getValue(machineId: string, id: string): Observable<SignalValue> {
    return this.api.get<SignalValue>(`/machines/${machineId}/signals/${id}/value`);
  }

  /**
   * docs/specs/08-historicos.md: histórico por rango. Nunca envía `resolution`
   * (docs/08-frontend-dashboard.md §8.7: el Backend siempre la decide).
   */
  getHistory(
    machineId: string,
    id: string,
    range: { from: Date; to: Date },
  ): Observable<SignalHistoryResponse> {
    return this.api.get<SignalHistoryResponse>(`/machines/${machineId}/signals/${id}/history`, {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import {
  AlarmDefinition,
  CreateAlarmDefinitionRequest,
  UpdateAlarmDefinitionRequest,
} from '../entities/alarm-definition.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "AlarmDefinition". */
@Injectable({ providedIn: 'root' })
export class AlarmDefinitionsApiService {
  private readonly api = inject(ApiService);

  list(signalId: string): Observable<AlarmDefinition[]> {
    return this.api.get<AlarmDefinition[]>(`/signals/${signalId}/alarm-definitions`);
  }

  create(signalId: string, request: CreateAlarmDefinitionRequest): Observable<AlarmDefinition> {
    return this.api.post<AlarmDefinition>(`/signals/${signalId}/alarm-definitions`, request);
  }

  update(id: string, request: UpdateAlarmDefinitionRequest): Observable<AlarmDefinition> {
    return this.api.patch<AlarmDefinition>(`/alarm-definitions/${id}`, request);
  }

  deactivate(id: string): Observable<void> {
    return this.api.delete<void>(`/alarm-definitions/${id}`);
  }
}

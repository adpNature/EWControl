import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { MachineConnection, ReplaceConnectionRequest } from '../entities/machine-connection.model';
import { CreateMachineRequest, Machine, UpdateMachineRequest } from '../entities/machine.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, secciones "Machine" y "MachineConnection". */
@Injectable({ providedIn: 'root' })
export class MachinesApiService {
  private readonly api = inject(ApiService);

  list(params: {
    limit: number;
    offset: number;
    /** docs/specs/14-historicos-comparativas.md: switcher de Company de un SuperAdmin. Ignorado para AdminCliente. */
    companyId?: string;
  }): Observable<PaginatedResponse<Machine>> {
    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.companyId) {
      query['companyId'] = params.companyId;
    }
    return this.api.get<PaginatedResponse<Machine>>('/machines', query);
  }

  get(id: string): Observable<Machine> {
    return this.api.get<Machine>(`/machines/${id}`);
  }

  create(request: CreateMachineRequest): Observable<Machine> {
    return this.api.post<Machine>('/machines', request);
  }

  update(id: string, request: UpdateMachineRequest): Observable<Machine> {
    return this.api.patch<Machine>(`/machines/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/machines/${id}`);
  }

  getConnection(machineId: string): Observable<MachineConnection> {
    return this.api.get<MachineConnection>(`/machines/${machineId}/connection`);
  }

  replaceConnection(
    machineId: string,
    request: ReplaceConnectionRequest,
  ): Observable<MachineConnection> {
    return this.api.put<MachineConnection>(`/machines/${machineId}/connection`, request);
  }
}

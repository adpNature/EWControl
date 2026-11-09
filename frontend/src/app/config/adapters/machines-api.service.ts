import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import {
  MachineConnection,
  OpcUaBrowseNode,
  OpcUaConnectionTestResult,
  OpcUaVariableSyncResult,
  ReplaceConnectionRequest,
  SaveOpcUaVariablesRequest,
} from '../entities/machine-connection.model';
import { CreateMachineRequest, Machine, UpdateMachineRequest } from '../entities/machine.model';

/**
 * Interface Adapter: llamadas HTTP de docs/11-api-rest.md, secciones "Machine" y
 * "MachineConnection" (prueba de conexión y exploración OPC UA: docs/specs/18-integracion-opc-ua.md;
 * sincronización de variables: docs/specs/21-sincronizacion-variables-opc-ua.md).
 */
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

  testOpcUaConnection(
    machineId: string,
    endpointUrl: string,
  ): Observable<OpcUaConnectionTestResult> {
    return this.api.post<OpcUaConnectionTestResult>(
      `/machines/${machineId}/connection/opcua/test`,
      { endpointUrl },
    );
  }

  /** Sin `nodeId` devuelve los hijos de `ObjectsFolder`. */
  browseOpcUaNodes(
    machineId: string,
    endpointUrl: string,
    nodeId?: string,
  ): Observable<{ nodes: OpcUaBrowseNode[] }> {
    return this.api.post<{ nodes: OpcUaBrowseNode[] }>(
      `/machines/${machineId}/connection/opcua/browse`,
      nodeId ? { endpointUrl, nodeId } : { endpointUrl },
    );
  }

  /** spec 21: lee las variables de `rootNodeId` y las compara con el mapeo guardado. Solo lectura. */
  syncOpcUaVariables(machineId: string, rootNodeId: string): Observable<OpcUaVariableSyncResult> {
    return this.api.post<OpcUaVariableSyncResult>(
      `/machines/${machineId}/connection/opcua/variables/sync`,
      { rootNodeId },
    );
  }

  /** spec 21: guarda en el `nodeMapping` las variables de una sincronización. */
  saveOpcUaVariables(
    machineId: string,
    request: SaveOpcUaVariablesRequest,
  ): Observable<MachineConnection> {
    return this.api.put<MachineConnection>(
      `/machines/${machineId}/connection/opcua/variables`,
      request,
    );
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import {
  WritePackage,
  WritePackageExecution,
  WritePackageList,
  WritePackageRequest,
} from '../entities/write-package.model';

/** Interface Adapter: docs/11-api-rest.md, sección "WritePackage" (docs/specs/20-paquetes-escritura-opc-ua.md). */
@Injectable({ providedIn: 'root' })
export class WritePackagesApiService {
  private readonly api = inject(ApiService);

  list(machineId: string): Observable<WritePackageList> {
    return this.api.get<WritePackageList>(this.base(machineId));
  }

  get(machineId: string, packageId: string): Observable<WritePackage> {
    return this.api.get<WritePackage>(`${this.base(machineId)}/${packageId}`);
  }

  create(machineId: string, request: WritePackageRequest): Observable<WritePackage> {
    return this.api.post<WritePackage>(this.base(machineId), request);
  }

  update(
    machineId: string,
    packageId: string,
    request: Partial<WritePackageRequest>,
  ): Observable<WritePackage> {
    return this.api.patch<WritePackage>(`${this.base(machineId)}/${packageId}`, request);
  }

  remove(machineId: string, packageId: string): Observable<void> {
    return this.api.delete<void>(`${this.base(machineId)}/${packageId}`);
  }

  /** Cuerpo vacío: el Backend escribe exactamente lo que tiene guardado el paquete. */
  execute(machineId: string, packageId: string): Observable<WritePackageExecution> {
    return this.api.post<WritePackageExecution>(`${this.base(machineId)}/${packageId}/execute`, {});
  }

  executions(
    machineId: string,
    packageId: string,
    params: { limit: number; offset: number },
  ): Observable<PaginatedResponse<WritePackageExecution>> {
    return this.api.get<PaginatedResponse<WritePackageExecution>>(
      `${this.base(machineId)}/${packageId}/executions`,
      params,
    );
  }

  private base(machineId: string): string {
    return `/machines/${machineId}/write-packages`;
  }
}

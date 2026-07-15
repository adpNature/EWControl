import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { Company, CreateCompanyRequest, UpdateCompanyRequest } from '../entities/company.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "Company". */
@Injectable({ providedIn: 'root' })
export class CompaniesApiService {
  private readonly api = inject(ApiService);

  list(params: { limit: number; offset: number }): Observable<PaginatedResponse<Company>> {
    return this.api.get<PaginatedResponse<Company>>('/companies', params);
  }

  get(id: string): Observable<Company> {
    return this.api.get<Company>(`/companies/${id}`);
  }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.api.post<Company>('/companies', request);
  }

  update(id: string, request: UpdateCompanyRequest): Observable<Company> {
    return this.api.patch<Company>(`/companies/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/companies/${id}`);
  }

  reactivate(id: string): Observable<Company> {
    return this.api.post<Company>(`/companies/${id}/reactivate`, {});
  }

  purge(id: string): Observable<void> {
    return this.api.delete<void>(`/companies/${id}/purge`);
  }
}

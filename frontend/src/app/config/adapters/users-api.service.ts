import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { CreateUserRequest, ManagedUser, UpdateUserRequest } from '../entities/user.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección "User". */
@Injectable({ providedIn: 'root' })
export class UsersApiService {
  private readonly api = inject(ApiService);

  list(params: {
    limit: number;
    offset: number;
    companyId?: string;
  }): Observable<PaginatedResponse<ManagedUser>> {
    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.companyId) {
      query['companyId'] = params.companyId;
    }
    return this.api.get<PaginatedResponse<ManagedUser>>('/users', query);
  }

  get(id: string): Observable<ManagedUser> {
    return this.api.get<ManagedUser>(`/users/${id}`);
  }

  create(request: CreateUserRequest): Observable<ManagedUser> {
    return this.api.post<ManagedUser>('/users', request);
  }

  update(id: string, request: UpdateUserRequest): Observable<ManagedUser> {
    return this.api.patch<ManagedUser>(`/users/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }
}

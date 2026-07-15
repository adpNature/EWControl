import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { UsersApiService } from '../adapters/users-api.service';
import { CreateUserRequest, ManagedUser, UpdateUserRequest } from '../entities/user.model';

const DEFAULT_LIMIT = 20;

/**
 * Use Case de la feature `config/` (docs/specs/10-gestion-companies-users.md):
 * estado de la lista de Users, mismo patrón signal+tap que `machines.state.ts`.
 * `load()` acepta un `companyId` opcional (switcher de Company de un
 * SuperAdmin, Documento 8 apartado 8.8) — un AdminCliente nunca lo usa.
 */
@Injectable({ providedIn: 'root' })
export class UsersState {
  private readonly usersApi = inject(UsersApiService);

  private readonly usersSignal = signal<ManagedUser[]>([]);
  private readonly loadingSignal = signal(false);

  readonly users = this.usersSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(companyId?: string): Observable<ManagedUser[]> {
    this.loadingSignal.set(true);
    return this.usersApi.list({ limit: DEFAULT_LIMIT, offset: 0, companyId }).pipe(
      tap({
        next: (response) => {
          this.usersSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  create(request: CreateUserRequest): Observable<ManagedUser> {
    return this.usersApi
      .create(request)
      .pipe(tap((user) => this.usersSignal.update((current) => [...current, user])));
  }

  update(id: string, request: UpdateUserRequest): Observable<ManagedUser> {
    return this.usersApi
      .update(id, request)
      .pipe(
        tap((updated) =>
          this.usersSignal.update((current) =>
            current.map((user) => (user.id === id ? updated : user)),
          ),
        ),
      );
  }

  remove(id: string): Observable<void> {
    return this.usersApi
      .remove(id)
      .pipe(
        tap(() => this.usersSignal.update((current) => current.filter((user) => user.id !== id))),
      );
  }

  reactivate(id: string): Observable<ManagedUser> {
    return this.usersApi
      .reactivate(id)
      .pipe(
        tap((reactivated) =>
          this.usersSignal.update((current) =>
            current.map((user) => (user.id === id ? reactivated : user)),
          ),
        ),
      );
  }
}

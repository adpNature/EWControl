import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { CompaniesApiService } from '../adapters/companies-api.service';
import { Company, CreateCompanyRequest, UpdateCompanyRequest } from '../entities/company.model';

const DEFAULT_LIMIT = 20;

/**
 * Use Case de la feature `config/` (docs/specs/10-gestion-companies-users.md):
 * estado de la lista de Companies, mismo patrón signal+tap que `machines.state.ts`.
 */
@Injectable({ providedIn: 'root' })
export class CompaniesState {
  private readonly companiesApi = inject(CompaniesApiService);

  private readonly companiesSignal = signal<Company[]>([]);
  private readonly loadingSignal = signal(false);

  readonly companies = this.companiesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(): Observable<Company[]> {
    this.loadingSignal.set(true);
    return this.companiesApi.list({ limit: DEFAULT_LIMIT, offset: 0 }).pipe(
      tap({
        next: (response) => {
          this.companiesSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  create(request: CreateCompanyRequest): Observable<Company> {
    return this.companiesApi
      .create(request)
      .pipe(tap((company) => this.companiesSignal.update((current) => [...current, company])));
  }

  update(id: string, request: UpdateCompanyRequest): Observable<Company> {
    return this.companiesApi
      .update(id, request)
      .pipe(
        tap((updated) =>
          this.companiesSignal.update((current) =>
            current.map((company) => (company.id === id ? updated : company)),
          ),
        ),
      );
  }

  remove(id: string): Observable<void> {
    return this.companiesApi
      .remove(id)
      .pipe(
        tap(() =>
          this.companiesSignal.update((current) => current.filter((company) => company.id !== id)),
        ),
      );
  }

  reactivate(id: string): Observable<Company> {
    return this.companiesApi
      .reactivate(id)
      .pipe(
        tap((reactivated) =>
          this.companiesSignal.update((current) =>
            current.map((company) => (company.id === id ? reactivated : company)),
          ),
        ),
      );
  }

  purge(id: string): Observable<void> {
    return this.companiesApi
      .purge(id)
      .pipe(
        tap(() =>
          this.companiesSignal.update((current) => current.filter((company) => company.id !== id)),
        ),
      );
  }
}

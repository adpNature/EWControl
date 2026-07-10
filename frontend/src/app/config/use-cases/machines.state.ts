import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { MachinesApiService } from '../adapters/machines-api.service';
import { CreateMachineRequest, Machine, UpdateMachineRequest } from '../entities/machine.model';

const DEFAULT_LIMIT = 20;

/**
 * Use Case de la feature `config/` (docs/specs/06-gestion-machines-signals.md):
 * estado de la lista de Machines, mismo patrón signal+tap que
 * `auth/use-cases/auth.state.ts` (sin duplicarlo en `core/`).
 */
@Injectable({ providedIn: 'root' })
export class MachinesState {
  private readonly machinesApi = inject(MachinesApiService);

  private readonly machinesSignal = signal<Machine[]>([]);
  private readonly loadingSignal = signal(false);

  readonly machines = this.machinesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(): Observable<Machine[]> {
    this.loadingSignal.set(true);
    return this.machinesApi.list({ limit: DEFAULT_LIMIT, offset: 0 }).pipe(
      tap({
        next: (response) => {
          this.machinesSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  create(request: CreateMachineRequest): Observable<Machine> {
    return this.machinesApi
      .create(request)
      .pipe(tap((machine) => this.machinesSignal.update((current) => [...current, machine])));
  }

  update(id: string, request: UpdateMachineRequest): Observable<Machine> {
    return this.machinesApi
      .update(id, request)
      .pipe(
        tap((updated) =>
          this.machinesSignal.update((current) =>
            current.map((machine) => (machine.id === id ? updated : machine)),
          ),
        ),
      );
  }

  remove(id: string): Observable<void> {
    return this.machinesApi
      .remove(id)
      .pipe(
        tap(() =>
          this.machinesSignal.update((current) => current.filter((machine) => machine.id !== id)),
        ),
      );
  }
}

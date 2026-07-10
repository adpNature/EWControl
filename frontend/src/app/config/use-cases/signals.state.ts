import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { SignalsApiService } from '../adapters/signals-api.service';
import { CreateSignalRequest, Signal, UpdateSignalRequest } from '../entities/signal.model';

const DEFAULT_LIMIT = 20;

/**
 * Estado de las Signals de "la Machine actualmente abierta"
 * (docs/specs/06-gestion-machines-signals.md): se recarga con `load(machineId)`
 * al entrar al detalle de una Machine.
 */
@Injectable({ providedIn: 'root' })
export class SignalsState {
  private readonly signalsApi = inject(SignalsApiService);

  private readonly signalsSignal = signal<Signal[]>([]);
  private readonly loadingSignal = signal(false);

  readonly signals = this.signalsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(machineId: string): Observable<Signal[]> {
    this.loadingSignal.set(true);
    return this.signalsApi.list(machineId, { limit: DEFAULT_LIMIT, offset: 0 }).pipe(
      tap({
        next: (response) => {
          this.signalsSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  create(machineId: string, request: CreateSignalRequest): Observable<Signal> {
    return this.signalsApi
      .create(machineId, request)
      .pipe(tap((signal) => this.signalsSignal.update((current) => [...current, signal])));
  }

  update(machineId: string, id: string, request: UpdateSignalRequest): Observable<Signal> {
    return this.signalsApi
      .update(machineId, id, request)
      .pipe(
        tap((updated) =>
          this.signalsSignal.update((current) =>
            current.map((signal) => (signal.id === id ? updated : signal)),
          ),
        ),
      );
  }

  remove(machineId: string, id: string): Observable<void> {
    return this.signalsApi
      .remove(machineId, id)
      .pipe(
        tap(() =>
          this.signalsSignal.update((current) => current.filter((signal) => signal.id !== id)),
        ),
      );
  }
}

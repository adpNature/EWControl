import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { AlarmClearedEvent, AlarmTriggeredEvent } from '../../core/websocket/realtime-events.model';
import { AlarmStatesApiService } from '../adapters/alarm-states-api.service';
import { AlarmState, AlarmStateFilters } from '../entities/alarm-state.model';

const DEFAULT_LIMIT = 20;

/**
 * Estado del panel de alarmas (docs/specs/09-alarmas.md): `load(filters)` trae
 * la foto inicial vía REST; `applyTriggered`/`applyCleared` aplican los
 * eventos de WebSocket sobre esa misma lista sin recargar, mismo principio
 * que el resto de vistas en tiempo real (nunca hacer polling con WS activo).
 */
@Injectable({ providedIn: 'root' })
export class AlarmStatesState {
  private readonly alarmStatesApi = inject(AlarmStatesApiService);

  private readonly alarmStatesSignal = signal<AlarmState[]>([]);
  private readonly loadingSignal = signal(false);

  readonly alarmStates = this.alarmStatesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(filters: AlarmStateFilters): Observable<AlarmState[]> {
    this.loadingSignal.set(true);
    return this.alarmStatesApi.list(filters, { limit: DEFAULT_LIMIT, offset: 0 }).pipe(
      tap({
        next: (response) => {
          this.alarmStatesSignal.set(response.data);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
      map((response) => response.data),
    );
  }

  applyTriggered(event: AlarmTriggeredEvent): void {
    const triggered: AlarmState = {
      id: event.alarmStateId,
      alarmDefinitionId: event.alarmDefinitionId,
      signalId: event.signalId,
      status: 'ACTIVE',
      priority: event.priority,
      activatedAt: event.timestamp,
      resolvedAt: null,
    };
    this.alarmStatesSignal.update((current) => [
      triggered,
      ...current.filter((alarmState) => alarmState.id !== event.alarmStateId),
    ]);
  }

  applyCleared(event: AlarmClearedEvent): void {
    this.alarmStatesSignal.update((current) =>
      current.map((alarmState) =>
        alarmState.id === event.alarmStateId
          ? { ...alarmState, status: 'INACTIVE', resolvedAt: event.timestamp }
          : alarmState,
      ),
    );
  }
}

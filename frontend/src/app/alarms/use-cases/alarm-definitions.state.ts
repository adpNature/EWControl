import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AlarmDefinitionsApiService } from '../adapters/alarm-definitions-api.service';
import {
  AlarmDefinition,
  CreateAlarmDefinitionRequest,
  UpdateAlarmDefinitionRequest,
} from '../entities/alarm-definition.model';

/**
 * Estado de las AlarmDefinition de "la Signal actualmente abierta"
 * (docs/specs/09-alarmas.md), mismo patrón que `SignalsState`.
 */
@Injectable({ providedIn: 'root' })
export class AlarmDefinitionsState {
  private readonly alarmDefinitionsApi = inject(AlarmDefinitionsApiService);

  private readonly definitionsSignal = signal<AlarmDefinition[]>([]);
  private readonly loadingSignal = signal(false);

  readonly definitions = this.definitionsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  load(signalId: string): Observable<AlarmDefinition[]> {
    this.loadingSignal.set(true);
    return this.alarmDefinitionsApi.list(signalId).pipe(
      tap({
        next: (definitions) => {
          this.definitionsSignal.set(definitions);
          this.loadingSignal.set(false);
        },
        error: () => this.loadingSignal.set(false),
      }),
    );
  }

  create(signalId: string, request: CreateAlarmDefinitionRequest): Observable<AlarmDefinition> {
    return this.alarmDefinitionsApi
      .create(signalId, request)
      .pipe(
        tap((definition) => this.definitionsSignal.update((current) => [...current, definition])),
      );
  }

  update(id: string, request: UpdateAlarmDefinitionRequest): Observable<AlarmDefinition> {
    return this.alarmDefinitionsApi
      .update(id, request)
      .pipe(
        tap((updated) =>
          this.definitionsSignal.update((current) =>
            current.map((definition) => (definition.id === id ? updated : definition)),
          ),
        ),
      );
  }

  deactivate(id: string): Observable<void> {
    return this.alarmDefinitionsApi
      .deactivate(id)
      .pipe(
        tap(() =>
          this.definitionsSignal.update((current) =>
            current.map((definition) =>
              definition.id === id ? { ...definition, isActive: false } : definition,
            ),
          ),
        ),
      );
  }
}

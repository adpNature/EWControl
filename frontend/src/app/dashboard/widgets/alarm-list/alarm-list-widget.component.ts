import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AlarmDefinitionsApiService } from '../../../alarms/adapters/alarm-definitions-api.service';
import { AlarmStatesApiService } from '../../../alarms/adapters/alarm-states-api.service';
import { AlarmState } from '../../../alarms/entities/alarm-state.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { AlarmPriorityBadgeComponent } from '../../../shared/ui/alarm-priority-badge/alarm-priority-badge.component';
import { DashboardWidget } from '../../entities/dashboard.model';

const LIST_LIMIT = 100;

/**
 * Widget ALARM_LIST (docs/specs/09-alarmas.md, cierra lo diferido por
 * docs/specs/07-dashboard-tiempo-real.md): carga las `AlarmState` `ACTIVE` de
 * las Signals del widget, cruzándolas contra las `AlarmDefinition` con
 * `showOnDashboard: true` (ese flag no existe en el contrato de
 * `GET /alarm-states`, así que el filtrado ocurre en el cliente). A partir de
 * ahí se mantiene en tiempo real con `AlarmTriggered`/`AlarmCleared`, mismo
 * patrón "REST inicial + WebSocket" que el widget CHART.
 */
@Component({
  selector: 'app-alarm-list-widget',
  standalone: true,
  imports: [AlarmPriorityBadgeComponent],
  templateUrl: './alarm-list-widget.component.html',
  styleUrl: './alarm-list-widget.component.scss',
})
export class AlarmListWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly alarmDefinitionsApi = inject(AlarmDefinitionsApiService);
  private readonly alarmStatesApi = inject(AlarmStatesApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private readonly subscriptions = new Subscription();
  private allowedDefinitionIds = new Set<string>();

  readonly alarms = signal<AlarmState[]>([]);
  readonly loadError = signal(false);

  signalName(signalId: string): string {
    return this.widget.signals.find((signalRef) => signalRef.id === signalId)?.name ?? signalId;
  }

  ngOnInit(): void {
    const signalIds = this.widget.signals.map((signalRef) => signalRef.id);
    if (signalIds.length === 0) {
      return;
    }

    forkJoin(signalIds.map((id) => this.alarmDefinitionsApi.list(id))).subscribe({
      next: (definitionLists) => {
        this.allowedDefinitionIds = new Set(
          definitionLists
            .flat()
            .filter((definition) => definition.isActive && definition.showOnDashboard)
            .map((definition) => definition.id),
        );
        this.loadActiveAlarms(signalIds);
      },
      error: () => this.loadError.set(true),
    });

    this.subscriptions.add(
      this.realtimeSocket.alarmTriggered$
        .pipe(
          filter(
            (event) =>
              signalIds.includes(event.signalId) &&
              this.allowedDefinitionIds.has(event.alarmDefinitionId),
          ),
        )
        .subscribe((event) => {
          const triggered: AlarmState = {
            id: event.alarmStateId,
            alarmDefinitionId: event.alarmDefinitionId,
            signalId: event.signalId,
            status: 'ACTIVE',
            priority: event.priority,
            activatedAt: event.timestamp,
            resolvedAt: null,
            ackedAt: null,
            ackedByUserId: null,
            ackedByEmail: null,
          };
          this.alarms.update((current) => [
            triggered,
            ...current.filter((alarmState) => alarmState.id !== event.alarmStateId),
          ]);
        }),
    );

    this.subscriptions.add(
      this.realtimeSocket.alarmCleared$
        .pipe(filter((event) => signalIds.includes(event.signalId)))
        .subscribe((event) => {
          this.alarms.update((current) =>
            current.filter((alarmState) => alarmState.id !== event.alarmStateId),
          );
        }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private loadActiveAlarms(signalIds: string[]): void {
    this.alarmStatesApi.list({ status: 'ACTIVE' }, { limit: LIST_LIMIT, offset: 0 }).subscribe({
      next: (response) => {
        this.alarms.set(
          response.data.filter(
            (alarmState) =>
              signalIds.includes(alarmState.signalId) &&
              this.allowedDefinitionIds.has(alarmState.alarmDefinitionId),
          ),
        );
      },
      // Degradación aislada (mismo criterio que el resto de widgets, docs/specs/07/08):
      // un fallo de REST no bloquea el resto del Dashboard.
      error: () => this.loadError.set(true),
    });
  }
}

import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MachinesState } from '../../../config/use-cases/machines.state';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AlarmPriority } from '../../entities/alarm-definition.model';
import { AlarmState, AlarmStateStatus } from '../../entities/alarm-state.model';
import { AlarmStatesState } from '../../use-cases/alarm-states.state';

const STATUSES: AlarmStateStatus[] = ['ACTIVE', 'INACTIVE'];
const PRIORITIES: AlarmPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const ALARM_STATE_COLUMNS: TableColumn<AlarmState>[] = [
  { key: 'signalId', header: 'Signal' },
  { key: 'status', header: 'Estado' },
  { key: 'priority', header: 'Prioridad' },
  { key: 'activatedAt', header: 'Activada', cell: (a) => new Date(a.activatedAt).toLocaleString() },
  {
    key: 'resolvedAt',
    header: 'Resuelta',
    cell: (a) => (a.resolvedAt ? new Date(a.resolvedAt).toLocaleString() : '—'),
  },
];

/**
 * docs/specs/09-alarmas.md, docs/08-frontend-dashboard.md §8.5: todas las
 * alarmas de la Company, con filtros, actualizadas en tiempo real por
 * WebSocket igual que el widget ALARM_LIST del Dashboard.
 */
@Component({
  selector: 'app-alarm-panel-page',
  standalone: true,
  imports: [ReactiveFormsModule, TableComponent, RouterLink, DatePipe],
  templateUrl: './alarm-panel-page.html',
  styleUrl: './alarm-panel-page.scss',
})
export class AlarmPanelPage implements OnInit, OnDestroy {
  protected readonly alarmStatesState = inject(AlarmStatesState);
  protected readonly machinesState = inject(MachinesState);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private readonly toastService = inject(ToastService);
  private readonly subscriptions = new Subscription();

  readonly statuses = STATUSES;
  readonly priorities = PRIORITIES;
  readonly columns = ALARM_STATE_COLUMNS;
  readonly rowKey = (alarmState: AlarmState): string => alarmState.id;

  readonly filters = new FormGroup({
    status: new FormControl<AlarmStateStatus | ''>('', { nonNullable: true }),
    machineId: new FormControl('', { nonNullable: true }),
    priority: new FormControl<AlarmPriority | ''>('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.machinesState.load().subscribe();
    this.applyFilters();
    this.subscriptions.add(
      this.realtimeSocket.alarmTriggered$.subscribe((event) =>
        this.alarmStatesState.applyTriggered(event),
      ),
    );
    this.subscriptions.add(
      this.realtimeSocket.alarmCleared$.subscribe((event) =>
        this.alarmStatesState.applyCleared(event),
      ),
    );
    this.subscriptions.add(
      this.realtimeSocket.alarmAcked$.subscribe((event) => this.alarmStatesState.applyAcked(event)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  applyFilters(): void {
    const { status, machineId, priority } = this.filters.getRawValue();
    this.alarmStatesState
      .load({
        status: status || undefined,
        machineId: machineId || undefined,
        priority: priority || undefined,
      })
      .subscribe();
  }

  ack(alarmState: AlarmState): void {
    this.alarmStatesState.ack(alarmState.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'Alarma reconocida.' }),
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido reconocer la alarma.' }),
    });
  }
}

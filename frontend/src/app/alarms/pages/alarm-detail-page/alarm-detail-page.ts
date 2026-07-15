import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AlarmStatesApiService } from '../../adapters/alarm-states-api.service';
import { AlarmState, AlarmStateDetail } from '../../entities/alarm-state.model';

const HISTORY_COLUMNS: TableColumn<AlarmState>[] = [
  { key: 'status', header: 'Estado' },
  { key: 'activatedAt', header: 'Activada', cell: (a) => new Date(a.activatedAt).toLocaleString() },
  {
    key: 'resolvedAt',
    header: 'Resuelta',
    cell: (a) => (a.resolvedAt ? new Date(a.resolvedAt).toLocaleString() : '—'),
  },
];

/**
 * docs/specs/09-alarmas.md, docs/specs/11-ack-alarmas.md: detalle de un
 * AlarmState, su histórico y el reconocimiento manual (ACK).
 */
@Component({
  selector: 'app-alarm-detail-page',
  standalone: true,
  imports: [TableComponent, DatePipe],
  templateUrl: './alarm-detail-page.html',
  styleUrl: './alarm-detail-page.scss',
})
export class AlarmDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly alarmStatesApi = inject(AlarmStatesApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private readonly toastService = inject(ToastService);
  private readonly subscriptions = new Subscription();

  readonly alarmState = signal<AlarmStateDetail | null>(null);
  readonly notFound = signal(false);
  readonly historyColumns = HISTORY_COLUMNS;
  readonly historyRowKey = (row: AlarmState): string => row.id;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.alarmStatesApi.get(id).subscribe({
      next: (detail) => this.alarmState.set(detail),
      error: () => this.notFound.set(true),
    });
    this.subscriptions.add(
      this.realtimeSocket.alarmAcked$.subscribe((event) => {
        if (event.alarmStateId !== id) {
          return;
        }
        this.alarmState.update((current) =>
          current
            ? {
                ...current,
                ackedAt: event.ackedAt,
                ackedByUserId: event.ackedByUserId,
                ackedByEmail: event.ackedByEmail,
              }
            : current,
        );
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ack(): void {
    const id = this.alarmState()?.id;
    if (!id) {
      return;
    }
    this.alarmStatesApi.ack(id).subscribe({
      next: (acked) => {
        this.alarmState.update((current) => (current ? { ...current, ...acked } : current));
        this.toastService.show({ type: 'success', message: 'Alarma reconocida.' });
      },
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido reconocer la alarma.' }),
    });
  }
}

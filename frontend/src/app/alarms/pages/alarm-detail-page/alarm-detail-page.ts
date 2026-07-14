import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AlarmStatesApiService } from '../../adapters/alarm-states-api.service';
import { AlarmState, AlarmStateDetail } from '../../entities/alarm-state.model';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';

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
 * docs/specs/09-alarmas.md: detalle de un AlarmState y el histórico completo
 * de su AlarmDefinition, siempre de solo lectura (sin ACK — Documento 8, §8.5).
 */
@Component({
  selector: 'app-alarm-detail-page',
  standalone: true,
  imports: [TableComponent],
  templateUrl: './alarm-detail-page.html',
  styleUrl: './alarm-detail-page.scss',
})
export class AlarmDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly alarmStatesApi = inject(AlarmStatesApiService);

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
  }
}

import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalQuality } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget, WidgetSignal } from '../../entities/dashboard.model';
import { TableWidgetConfig } from '../../entities/widget-config.model';
import { formatSignalValue } from '../shared/format-signal-value';
import { SignalQualityBadgeComponent } from '../shared/signal-quality-badge/signal-quality-badge.component';

type Column = 'value' | 'quality' | 'timestamp';
const DEFAULT_COLUMNS: Column[] = ['value', 'quality', 'timestamp'];

interface Row {
  signal: WidgetSignal;
  value: number | boolean | string | null;
  quality: SignalQuality | null;
  timestamp: string | null;
}

/** Widget TABLE (docs/specs/07-dashboard-tiempo-real.md): valores de varias Signals en tabla. */
@Component({
  selector: 'app-table-widget',
  standalone: true,
  imports: [SignalQualityBadgeComponent],
  templateUrl: './table-widget.component.html',
  styleUrl: './table-widget.component.scss',
})
export class TableWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly signalsApi = inject(SignalsApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private subscription?: Subscription;

  readonly rows = signal<Row[]>([]);

  get columns(): Column[] {
    const config = this.widget.widgetConfig as TableWidgetConfig;
    return config.columns ?? DEFAULT_COLUMNS;
  }

  ngOnInit(): void {
    this.rows.set(
      this.widget.signals.map((signalRef) => ({
        signal: signalRef,
        value: null,
        quality: null,
        timestamp: null,
      })),
    );

    for (const signalRef of this.widget.signals) {
      this.signalsApi.getValue(signalRef.machineId, signalRef.id).subscribe({
        next: (value) => this.patchRow(signalRef.id, value.value, value.quality, value.timestamp),
        error: () => undefined,
      });
    }

    const signalIds = new Set(this.widget.signals.map((signalRef) => signalRef.id));
    this.subscription = this.realtimeSocket.signalUpdates$
      .pipe(filter((event) => signalIds.has(event.signalId)))
      .subscribe((event) =>
        this.patchRow(event.signalId, event.value, event.quality, event.timestamp),
      );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  formatValue(value: Row['value']): string {
    return value === null ? '' : formatSignalValue(value);
  }

  private patchRow(
    signalId: string,
    value: number | boolean | string,
    quality: SignalQuality,
    timestamp: string,
  ): void {
    this.rows.update((current) =>
      current.map((row) =>
        row.signal.id === signalId ? { ...row, value, quality, timestamp } : row,
      ),
    );
  }
}

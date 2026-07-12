import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalQuality } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { ValueWidgetConfig } from '../../entities/widget-config.model';
import { formatSignalValue } from '../shared/format-signal-value';
import { SignalQualityBadgeComponent } from '../shared/signal-quality-badge/signal-quality-badge.component';

interface DisplayValue {
  value: number | boolean | string;
  quality: SignalQuality;
}

/**
 * Widget VALUE (docs/specs/07-dashboard-tiempo-real.md): lectura inicial vía
 * REST + actualización en vivo por WebSocket, filtrando `signalUpdates$` por
 * `signalId`. Sin valor disponible (FORMULA o DIRECT sin tick aún) muestra un
 * estado explícito, nunca un valor engañoso.
 */
@Component({
  selector: 'app-value-widget',
  standalone: true,
  imports: [SignalQualityBadgeComponent],
  templateUrl: './value-widget.component.html',
  styleUrl: './value-widget.component.scss',
})
export class ValueWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly signalsApi = inject(SignalsApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private subscription?: Subscription;

  readonly current = signal<DisplayValue | null>(null);

  get signalRef() {
    return this.widget.signals[0];
  }

  get config(): ValueWidgetConfig {
    return this.widget.widgetConfig as ValueWidgetConfig;
  }

  ngOnInit(): void {
    const signalRef = this.signalRef;
    if (!signalRef) {
      return;
    }
    this.signalsApi.getValue(signalRef.machineId, signalRef.id).subscribe({
      next: (value) => this.current.set({ value: value.value, quality: value.quality }),
      error: () => this.current.set(null),
    });
    this.subscription = this.realtimeSocket.signalUpdates$
      .pipe(filter((event) => event.signalId === signalRef.id))
      .subscribe((event) => this.current.set({ value: event.value, quality: event.quality }));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  formattedValue(): string {
    const current = this.current();
    if (!current) {
      return '';
    }
    return formatSignalValue(current.value, this.config.decimals);
  }
}

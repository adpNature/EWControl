import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalQuality } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { DashboardWidget } from '../../entities/dashboard.model';
import { GaugeWidgetConfig } from '../../entities/widget-config.model';
import { formatSignalValue } from '../shared/format-signal-value';
import { SignalQualityBadgeComponent } from '../shared/signal-quality-badge/signal-quality-badge.component';

interface DisplayValue {
  value: number | boolean | string;
  quality: SignalQuality;
}

/** Widget GAUGE (docs/specs/07-dashboard-tiempo-real.md): valor actual sobre una escala min/max. */
@Component({
  selector: 'app-gauge-widget',
  standalone: true,
  imports: [SignalQualityBadgeComponent],
  templateUrl: './gauge-widget.component.html',
  styleUrl: './gauge-widget.component.scss',
})
export class GaugeWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly signalsApi = inject(SignalsApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private subscription?: Subscription;

  readonly current = signal<DisplayValue | null>(null);

  get signalRef() {
    return this.widget.signals[0];
  }

  get config(): GaugeWidgetConfig {
    return this.widget.widgetConfig as GaugeWidgetConfig;
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

  get percentage(): number {
    const current = this.current();
    const { min, max } = this.config;
    if (!current || typeof current.value !== 'number' || max <= min) {
      return 0;
    }
    const clamped = Math.min(Math.max(current.value, min), max);
    return ((clamped - min) / (max - min)) * 100;
  }

  formattedValue(): string {
    const current = this.current();
    if (!current) {
      return '';
    }
    return formatSignalValue(current.value, this.config.decimals);
  }
}

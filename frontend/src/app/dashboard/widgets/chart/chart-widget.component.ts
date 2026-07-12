import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { SignalQuality } from '../../../core/websocket/realtime-events.model';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import {
  HistoryRange,
  RangeSelectorComponent,
} from '../../../shared/ui/range-selector/range-selector.component';
import { DashboardWidget } from '../../entities/dashboard.model';
import { ChartWidgetConfig } from '../../entities/widget-config.model';
import { formatSignalValue } from '../shared/format-signal-value';
import { SignalQualityBadgeComponent } from '../shared/signal-quality-badge/signal-quality-badge.component';

interface Point {
  t: number;
  v: number;
}

const DEFAULT_MAX_POINTS = 50;
const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;
const DEFAULT_RANGE_HOURS = 1;

function defaultRange(): HistoryRange {
  const to = new Date();
  return { from: new Date(to.getTime() - DEFAULT_RANGE_HOURS * 60 * 60 * 1000), to };
}

/**
 * Widget CHART (docs/specs/08-historicos.md): al abrirse carga histórico real
 * para un rango (por defecto, última hora) y a partir de ahí sigue acumulando
 * los puntos recibidos por WebSocket sobre esa misma serie, acotada por
 * `config.maxPoints`. El propio widget permite cambiar el rango consultado sin
 * afectar a los demás widgets del Dashboard (Documento 8, apartado 8.7).
 */
@Component({
  selector: 'app-chart-widget',
  standalone: true,
  imports: [SignalQualityBadgeComponent, RangeSelectorComponent],
  templateUrl: './chart-widget.component.html',
  styleUrl: './chart-widget.component.scss',
})
export class ChartWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly signalsApi = inject(SignalsApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private subscription?: Subscription;

  readonly points = signal<Point[]>([]);
  readonly latestQuality = signal<SignalQuality | null>(null);

  get signalRef() {
    return this.widget.signals[0];
  }

  get config(): ChartWidgetConfig {
    return this.widget.widgetConfig as ChartWidgetConfig;
  }

  private get maxPoints(): number {
    return this.config.maxPoints ?? DEFAULT_MAX_POINTS;
  }

  ngOnInit(): void {
    const signalRef = this.signalRef;
    if (!signalRef) {
      return;
    }
    this.loadHistory(defaultRange());

    this.signalsApi.getValue(signalRef.machineId, signalRef.id).subscribe({
      next: (value) => this.latestQuality.set(value.quality),
      error: () => undefined,
    });
    this.subscription = this.realtimeSocket.signalUpdates$
      .pipe(filter((event) => event.signalId === signalRef.id))
      .subscribe((event) => {
        this.latestQuality.set(event.quality);
        if (typeof event.value === 'number') {
          this.pushPoint(new Date(event.timestamp).getTime(), event.value);
        }
      });
  }

  onRangeChange(range: HistoryRange): void {
    this.loadHistory(range);
  }

  private loadHistory(range: HistoryRange): void {
    const signalRef = this.signalRef;
    if (!signalRef) {
      return;
    }
    this.signalsApi.getHistory(signalRef.machineId, signalRef.id, range).subscribe({
      next: (response) => {
        const mapped = response.points.map((point) => ({
          t: new Date(point.timestamp).getTime(),
          v: point.value,
        }));
        this.points.set(
          mapped.length > this.maxPoints ? mapped.slice(mapped.length - this.maxPoints) : mapped,
        );
      },
      // Degradación a "solo tiempo real" (docs/specs/08-historicos.md): un fallo
      // al consultar histórico no bloquea el resto del Dashboard ni impide que
      // los ticks en vivo sigan acumulándose sobre los puntos ya cargados.
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get pathD(): string {
    const points = this.points();
    if (points.length === 0) {
      return '';
    }
    const values = points.map((point) => point.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = points.length === 1 ? 0 : (index / (points.length - 1)) * VIEWBOX_WIDTH;
        const y = VIEWBOX_HEIGHT - ((point.v - min) / range) * VIEWBOX_HEIGHT;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  get latestValue(): number | undefined {
    const points = this.points();
    return points.length > 0 ? points[points.length - 1].v : undefined;
  }

  get formattedLatestValue(): string {
    const value = this.latestValue;
    return value === undefined ? '' : formatSignalValue(value);
  }

  private pushPoint(t: number, v: number): void {
    this.points.update((current) => {
      const next = [...current, { t, v }];
      return next.length > this.maxPoints ? next.slice(next.length - this.maxPoints) : next;
    });
  }
}

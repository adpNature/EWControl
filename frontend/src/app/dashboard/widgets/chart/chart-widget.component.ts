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
/** Paso de ←/→ como fracción del ancho (WCAG 2.1 AA 2.1.1/1.4.13: equivalente por teclado del hover). */
const KEYBOARD_STEP = 0.02;

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

  /** Posición del cursor sobre el SVG, como fracción [0, 1] de su ancho; `null` si no hay hover. */
  readonly hoveredFraction = signal<number | null>(null);
  readonly viewBoxWidth = VIEWBOX_WIDTH;
  readonly viewBoxHeight = VIEWBOX_HEIGHT;

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

  /** Punto bajo el cursor (posición relativa, igual criterio que `multi-series-chart`). */
  get hoveredPoint(): Point | null {
    const fraction = this.hoveredFraction();
    const points = this.points();
    if (fraction === null || points.length === 0) {
      return null;
    }
    const index = Math.round(fraction * (points.length - 1));
    return points[index];
  }

  get formattedHoveredValue(): string {
    const point = this.hoveredPoint;
    return point === null ? '' : formatSignalValue(point.v);
  }

  /** Anunciado por una región `aria-live` oculta: mismo contenido que el tooltip visual. */
  get hoveredSummary(): string {
    if (this.hoveredPoint === null) {
      return '';
    }
    return `${this.formattedHoveredValue} ${this.signalRef?.unit ?? ''}`;
  }

  onSvgMouseMove(event: MouseEvent): void {
    const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    this.hoveredFraction.set(Math.min(1, Math.max(0, fraction)));
  }

  onSvgMouseLeave(): void {
    this.hoveredFraction.set(null);
  }

  /** Al entrar por teclado (Tab), revela el tooltip igual que el hover — sin esperar a una tecla más. */
  onSvgFocus(): void {
    this.hoveredFraction.update((current) => current ?? 0);
  }

  onSvgBlur(): void {
    this.hoveredFraction.set(null);
  }

  /** Equivalente por teclado del hover con el ratón (WCAG 2.1 AA 2.1.1 Keyboard / 1.4.13). */
  onSvgKeyDown(event: KeyboardEvent): void {
    const current = this.hoveredFraction() ?? 0;
    switch (event.key) {
      case 'ArrowRight':
        this.hoveredFraction.set(Math.min(1, current + KEYBOARD_STEP));
        break;
      case 'ArrowLeft':
        this.hoveredFraction.set(Math.max(0, current - KEYBOARD_STEP));
        break;
      case 'Home':
        this.hoveredFraction.set(0);
        break;
      case 'End':
        this.hoveredFraction.set(1);
        break;
      case 'Escape':
        this.hoveredFraction.set(null);
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  private pushPoint(t: number, v: number): void {
    this.points.update((current) => {
      const next = [...current, { t, v }];
      return next.length > this.maxPoints ? next.slice(next.length - this.maxPoints) : next;
    });
  }
}

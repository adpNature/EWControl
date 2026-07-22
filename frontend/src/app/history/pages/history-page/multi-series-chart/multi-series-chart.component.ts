import { Component, Input, signal } from '@angular/core';
import { SignalHistoryPoint } from '../../../../core/websocket/realtime-events.model';
import { formatSignalValue } from '../../../../dashboard/widgets/shared/format-signal-value';
import { HistoryRange } from '../../../../shared/ui/range-selector/range-selector.component';

export interface ChartSeries {
  signalId: string;
  label: string;
  unit: string;
  points: SignalHistoryPoint[];
}

interface RenderedSeries {
  signalId: string;
  label: string;
  unit: string;
  color: string;
  points: SignalHistoryPoint[];
  pathD: string;
  latestValue: number | null;
  hasData: boolean;
  /** Un único punto no traza ningún segmento de línea visible (spec: se comunica en vez de ocultarlo). */
  hasEnoughPointsToPlot: boolean;
}

export interface HoveredSeriesValue {
  signalId: string;
  label: string;
  unit: string;
  color: string;
  value: number;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;
const X_AXIS_TICK_COUNT = 5;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Paso de ←/→ como fracción del ancho (WCAG 2.1 AA 2.1.1/1.4.13: equivalente por teclado del hover). */
const KEYBOARD_STEP = 0.02;

/** Formato adaptado al span total del rango: minutos/horas si es corto, fecha si es largo. */
function formatAxisTick(date: Date, spanMs: number): string {
  if (spanMs <= 3 * HOUR_MS) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (spanMs <= 3 * DAY_MS) {
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

/**
 * Paleta categórica fija (docs/specs/14-historicos-comparativas.md): hasta 8
 * series, una por color, sin depender de ninguna librería de charting — mismo
 * enfoque SVG a mano que `ChartWidgetComponent`, pero sin su acumulación en
 * vivo por WebSocket (esta pantalla no tiene, es una consulta puntual). La
 * primera serie usa el color primario de marca (`--primary-color`); el resto,
 * al no tener equivalente en la paleta de tema, queda en hex fijo.
 */
const PALETTE = [
  'var(--primary-color)',
  'var(--text-color)',
  '#16a34a',
  '#d97706',
  '#9333ea',
  '#0891b2',
  '#db2777',
  '#65a30d',
];

/**
 * Gráfico comparativo multi-serie (docs/specs/14-historicos-comparativas.md):
 * cada serie se normaliza a su propio min/max — comparación de forma/tendencia
 * relativa, no de magnitud absoluta entre unidades distintas (deliberado, ver
 * "Alcance explícito" de la spec).
 */
@Component({
  selector: 'app-multi-series-chart',
  standalone: true,
  templateUrl: './multi-series-chart.component.html',
  styleUrl: './multi-series-chart.component.scss',
})
export class MultiSeriesChartComponent {
  @Input({ required: true }) series: ChartSeries[] = [];
  /** Rango temporal de la consulta (Given/When/Then de la spec): fuente de las etiquetas del eje X. */
  @Input() range?: HistoryRange;

  readonly viewBox = `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`;
  readonly viewBoxWidth = VIEWBOX_WIDTH;
  readonly viewBoxHeight = VIEWBOX_HEIGHT;

  /** Guías del eje Y (spec: normalización por serie, sin magnitud absoluta compartida — ver PALETTE). */
  readonly yAxisTicks = ['100 %', '50 %', '0 %'];

  /** Posición del cursor sobre el SVG, como fracción [0, 1] de su ancho; `null` si no hay hover. */
  readonly hoveredFraction = signal<number | null>(null);

  get xAxisTicks(): string[] {
    if (!this.range) {
      return [];
    }
    const fromMs = this.range.from.getTime();
    const spanMs = this.range.to.getTime() - fromMs;
    return Array.from({ length: X_AXIS_TICK_COUNT }).map((unusedItem, i) => {
      const tickMs = fromMs + (i / (X_AXIS_TICK_COUNT - 1)) * spanMs;
      return formatAxisTick(new Date(tickMs), spanMs);
    });
  }

  get renderedSeries(): RenderedSeries[] {
    return this.series.map((s, index) => ({
      signalId: s.signalId,
      label: s.label,
      unit: s.unit,
      color: PALETTE[index % PALETTE.length],
      points: s.points,
      pathD: this.buildPathD(s.points),
      latestValue: s.points.length > 0 ? s.points[s.points.length - 1].value : null,
      hasData: s.points.length > 0,
      hasEnoughPointsToPlot: s.points.length >= 2,
    }));
  }

  /** Valor de cada serie en la posición X bajo el cursor (spec: comparación por posición relativa, no por timestamp exacto). */
  get hoveredSeries(): HoveredSeriesValue[] {
    const fraction = this.hoveredFraction();
    if (fraction === null) {
      return [];
    }
    return this.renderedSeries
      .filter((s) => s.hasEnoughPointsToPlot)
      .map((s) => {
        const index = Math.round(fraction * (s.points.length - 1));
        return {
          signalId: s.signalId,
          label: s.label,
          unit: s.unit,
          color: s.color,
          value: s.points[index].value,
        };
      });
  }

  /** Anunciado por una región `aria-live` oculta: mismo contenido que el tooltip visual. */
  get hoveredSummary(): string {
    return this.hoveredSeries
      .map((item) => `${item.label}: ${this.formattedValue(item.value)} ${item.unit}`)
      .join('; ');
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

  formattedValue(value: number | null): string {
    return value === null ? '' : formatSignalValue(value);
  }

  private buildPathD(points: SignalHistoryPoint[]): string {
    if (points.length < 2) {
      return '';
    }
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * VIEWBOX_WIDTH;
        const y = VIEWBOX_HEIGHT - ((point.value - min) / range) * VIEWBOX_HEIGHT;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }
}

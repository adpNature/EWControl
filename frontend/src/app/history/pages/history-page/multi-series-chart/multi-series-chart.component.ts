import { Component, Input } from '@angular/core';
import { SignalHistoryPoint } from '../../../../core/websocket/realtime-events.model';
import { formatSignalValue } from '../../../../dashboard/widgets/shared/format-signal-value';

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
  pathD: string;
  latestValue: number | null;
  hasData: boolean;
  /** Un único punto no traza ningún segmento de línea visible (spec: se comunica en vez de ocultarlo). */
  hasEnoughPointsToPlot: boolean;
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 40;

/**
 * Paleta categórica fija (docs/specs/14-historicos-comparativas.md): hasta 8
 * series, una por color, sin depender de ninguna librería de charting — mismo
 * enfoque SVG a mano que `ChartWidgetComponent`, pero sin su acumulación en
 * vivo por WebSocket (esta pantalla no tiene, es una consulta puntual).
 */
const PALETTE = [
  '#2563eb',
  '#dc2626',
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

  readonly viewBox = `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`;

  get renderedSeries(): RenderedSeries[] {
    return this.series.map((s, index) => ({
      signalId: s.signalId,
      label: s.label,
      unit: s.unit,
      color: PALETTE[index % PALETTE.length],
      pathD: this.buildPathD(s.points),
      latestValue: s.points.length > 0 ? s.points[s.points.length - 1].value : null,
      hasData: s.points.length > 0,
      hasEnoughPointsToPlot: s.points.length >= 2,
    }));
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

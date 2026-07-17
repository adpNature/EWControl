import { render, screen } from '@testing-library/angular';
import { ChartSeries, MultiSeriesChartComponent } from './multi-series-chart.component';

describe('MultiSeriesChartComponent', () => {
  it('sin series, muestra un mensaje invitando a seleccionar Signals', async () => {
    await render(MultiSeriesChartComponent, { componentInputs: { series: [] } });

    expect(screen.getByText('Selecciona al menos una Signal para comparar.')).toBeInTheDocument();
  });

  it('pinta la leyenda con Machine/Signal/unidad/último valor de cada serie con datos', async () => {
    const series: ChartSeries[] = [
      {
        signalId: 'signal-1',
        label: 'Torno 3 — Temperatura',
        unit: '°C',
        points: [
          { timestamp: '2026-07-12T09:00:00Z', value: 20 },
          { timestamp: '2026-07-12T09:30:00Z', value: 24.8 },
        ],
      },
    ];

    await render(MultiSeriesChartComponent, { componentInputs: { series } });

    expect(screen.getByText('Torno 3 — Temperatura')).toBeInTheDocument();
    expect(screen.getByText('24,80 °C')).toBeInTheDocument();
  });

  it('una serie sin puntos muestra "sin datos en este rango" en su propia entrada de leyenda', async () => {
    const series: ChartSeries[] = [
      { signalId: 'signal-1', label: 'Torno 3 — Temperatura', unit: '°C', points: [] },
    ];

    await render(MultiSeriesChartComponent, { componentInputs: { series } });

    expect(screen.getByText('sin datos en este rango')).toBeInTheDocument();
  });

  it('una serie con un único punto no dibuja línea y avisa de que no hay suficientes valores', async () => {
    const series: ChartSeries[] = [
      {
        signalId: 'signal-1',
        label: 'Torno 3 — Temperatura',
        unit: '°C',
        points: [{ timestamp: '2026-07-17T18:50:00Z', value: 12.5 }],
      },
    ];

    const { container } = await render(MultiSeriesChartComponent, {
      componentInputs: { series },
    });

    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(
      screen.getByText(
        '12,50 °C — no hay suficientes valores en este rango para dibujar la gráfica',
      ),
    ).toBeInTheDocument();
  });
});

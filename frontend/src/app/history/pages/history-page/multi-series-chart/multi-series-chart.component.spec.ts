import { fireEvent, render, screen } from '@testing-library/angular';
import { ChartSeries, MultiSeriesChartComponent } from './multi-series-chart.component';

/** jsdom no calcula layout real: fijamos el rect del SVG para que la fracción hover sea determinista. */
function mockSvgRect(svg: Element, width = 100): void {
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    width,
    top: 0,
    height: 40,
    right: width,
    bottom: 40,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

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

  describe('tooltip al pasar el ratón', () => {
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
      {
        signalId: 'signal-2',
        label: 'Torno 3 — Corriente',
        unit: 'A',
        points: [
          { timestamp: '2026-07-12T09:00:00Z', value: 5 },
          { timestamp: '2026-07-12T09:30:00Z', value: 9 },
        ],
      },
    ];

    it('no muestra tooltip sin hover', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });

      expect(container.querySelector('.multi-series-chart__tooltip')).not.toBeInTheDocument();
    });

    it('al pasar el ratón cerca del inicio, muestra el valor de cada serie en esa posición', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      mockSvgRect(svg);

      fireEvent.mouseMove(svg, { clientX: 0 });

      const tooltip = container.querySelector('.multi-series-chart__tooltip');
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveTextContent('Torno 3 — Temperatura: 20,00 °C');
      expect(tooltip).toHaveTextContent('Torno 3 — Corriente: 5,00 A');
      expect(tooltip).not.toHaveClass('multi-series-chart__tooltip--flip');
    });

    it('al pasar el ratón cerca del final, muestra el último valor y abre el tooltip hacia la izquierda', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      mockSvgRect(svg);

      fireEvent.mouseMove(svg, { clientX: 99 });

      const tooltip = container.querySelector('.multi-series-chart__tooltip');
      expect(tooltip).toHaveTextContent('Torno 3 — Temperatura: 24,80 °C');
      expect(tooltip).toHaveTextContent('Torno 3 — Corriente: 9,00 A');
      expect(tooltip).toHaveClass('multi-series-chart__tooltip--flip');
    });

    it('al salir el ratón del gráfico, oculta el tooltip', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      mockSvgRect(svg);

      fireEvent.mouseMove(svg, { clientX: 0 });
      expect(container.querySelector('.multi-series-chart__tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(svg);
      expect(container.querySelector('.multi-series-chart__tooltip')).not.toBeInTheDocument();
    });
  });

  describe('equivalente por teclado del tooltip (WCAG 2.1 AA 2.1.1 / 1.4.13)', () => {
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

    it('al enfocar el gráfico (Tab), muestra el tooltip en la primera posición', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });

      fireEvent.focus(svg);

      expect(container.querySelector('.multi-series-chart__tooltip')).toHaveTextContent(
        'Torno 3 — Temperatura: 20,00 °C',
      );
    });

    it('la flecha derecha avanza la posición', async () => {
      const { fixture } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      fireEvent.focus(svg);
      expect(fixture.componentInstance.hoveredFraction()).toBe(0);

      fireEvent.keyDown(svg, { key: 'ArrowRight' });

      expect(fixture.componentInstance.hoveredFraction()).toBeCloseTo(0.02);
    });

    it('End salta al último punto y la región aria-live anuncia el valor', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      fireEvent.focus(svg);

      fireEvent.keyDown(svg, { key: 'End' });

      expect(container.querySelector('.multi-series-chart__tooltip')).toHaveTextContent(
        'Torno 3 — Temperatura: 24,80 °C',
      );
      expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
        'Torno 3 — Temperatura: 24,80 °C',
      );
    });

    it('Escape oculta el tooltip sin perder el foco', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      fireEvent.focus(svg);
      expect(container.querySelector('.multi-series-chart__tooltip')).toBeInTheDocument();

      fireEvent.keyDown(svg, { key: 'Escape' });

      expect(container.querySelector('.multi-series-chart__tooltip')).not.toBeInTheDocument();
    });

    it('al perder el foco (blur), oculta el tooltip', async () => {
      const { container } = await render(MultiSeriesChartComponent, {
        componentInputs: { series },
      });
      const svg = screen.getByRole('img', { name: /Comparativa de históricos/ });
      fireEvent.focus(svg);
      expect(container.querySelector('.multi-series-chart__tooltip')).toBeInTheDocument();

      fireEvent.blur(svg);

      expect(container.querySelector('.multi-series-chart__tooltip')).not.toBeInTheDocument();
    });
  });
});

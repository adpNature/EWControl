import { render, screen } from '@testing-library/angular';
import { SignalQualityBadgeComponent } from './signal-quality-badge.component';

describe('SignalQualityBadgeComponent', () => {
  it('muestra "OK" para GOOD', async () => {
    await render(SignalQualityBadgeComponent, { inputs: { quality: 'GOOD' } });

    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('muestra "Sin comunicación" para OFFLINE', async () => {
    await render(SignalQualityBadgeComponent, { inputs: { quality: 'OFFLINE' } });

    expect(screen.getByText('Sin comunicación')).toBeInTheDocument();
  });

  it('muestra "Error" para BAD y "Incierto" para UNCERTAIN', async () => {
    const { rerender } = await render(SignalQualityBadgeComponent, {
      inputs: { quality: 'BAD' },
    });
    expect(screen.getByText('Error')).toBeInTheDocument();

    await rerender({ inputs: { quality: 'UNCERTAIN' } });
    expect(screen.getByText('Incierto')).toBeInTheDocument();
  });
});

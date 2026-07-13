import { render, screen } from '@testing-library/angular';
import { AlarmPriorityBadgeComponent } from './alarm-priority-badge.component';

describe('AlarmPriorityBadgeComponent', () => {
  it.each([
    ['LOW', 'Baja'],
    ['MEDIUM', 'Media'],
    ['HIGH', 'Alta'],
    ['CRITICAL', 'Crítica'],
  ] as const)('muestra la etiqueta en español para %s', async (priority, label) => {
    await render(AlarmPriorityBadgeComponent, { inputs: { priority } });

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

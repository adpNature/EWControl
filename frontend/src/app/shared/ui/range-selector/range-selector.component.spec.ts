import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RangeSelectorComponent } from './range-selector.component';

describe('RangeSelectorComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marca "Última hora" como preset activo por defecto', async () => {
    await render(RangeSelectorComponent);

    expect(screen.getByRole('button', { name: 'Última hora' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('emite from/to calculados al seleccionar un preset, y lo marca activo', async () => {
    const { fixture } = await render(RangeSelectorComponent);
    let emitted: { from: Date; to: Date } | undefined;
    fixture.componentInstance.rangeChange.subscribe((range) => (emitted = range));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    await user.click(screen.getByRole('button', { name: 'Último día' }));

    expect(emitted).toEqual({
      from: new Date('2026-07-11T12:00:00Z'),
      to: new Date('2026-07-12T12:00:00Z'),
    });
    expect(screen.getByRole('button', { name: 'Último día' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Última hora' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { isValidGaugeWidgetConfig } from './widget-config.vo';

describe('isValidGaugeWidgetConfig', () => {
  it('acepta un rango donde min es menor que max', () => {
    expect(isValidGaugeWidgetConfig({ min: 0, max: 100 })).toBe(true);
  });

  it('rechaza un rango donde min es igual a max', () => {
    expect(isValidGaugeWidgetConfig({ min: 50, max: 50 })).toBe(false);
  });

  it('rechaza un rango donde min es mayor que max', () => {
    expect(isValidGaugeWidgetConfig({ min: 100, max: 0 })).toBe(false);
  });

  it('rechaza min/max no numéricos', () => {
    expect(
      isValidGaugeWidgetConfig({ min: undefined, max: 100 } as unknown as {
        min: number;
        max: number;
      }),
    ).toBe(false);
  });
});

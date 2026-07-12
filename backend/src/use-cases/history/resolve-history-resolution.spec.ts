import { describe, expect, it } from 'vitest';
import { resolveHistoryResolution } from './resolve-history-resolution';

const FROM = new Date('2026-07-01T00:00:00Z');

function toDate(hours: number): Date {
  return new Date(FROM.getTime() + hours * 60 * 60 * 1000);
}

describe('resolveHistoryResolution', () => {
  it('devuelve raw para un span de hasta 6 horas', () => {
    expect(resolveHistoryResolution(FROM, toDate(1))).toBe('raw');
    expect(resolveHistoryResolution(FROM, toDate(6))).toBe('raw');
  });

  it('devuelve minute para un span de más de 6 horas y hasta 2 días', () => {
    expect(resolveHistoryResolution(FROM, toDate(6.01))).toBe('minute');
    expect(resolveHistoryResolution(FROM, toDate(48))).toBe('minute');
  });

  it('devuelve hour para un span de más de 2 días y hasta 30 días', () => {
    expect(resolveHistoryResolution(FROM, toDate(48.01))).toBe('hour');
    expect(resolveHistoryResolution(FROM, toDate(30 * 24))).toBe('hour');
  });

  it('devuelve day para un span de más de 30 días y hasta 180 días', () => {
    expect(resolveHistoryResolution(FROM, toDate(30 * 24 + 0.01))).toBe('day');
    expect(resolveHistoryResolution(FROM, toDate(180 * 24))).toBe('day');
  });

  it('devuelve month para un span de más de 180 días', () => {
    expect(resolveHistoryResolution(FROM, toDate(180 * 24 + 0.01))).toBe('month');
  });
});

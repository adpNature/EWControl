import { describe, expect, it } from 'vitest';
import { InMemoryRawVariableCache, type RawVariableCacheEntry } from './raw-variable-cache';
import { SignalQuality } from './signal-quality.enum';

function buildEntry(overrides: Partial<RawVariableCacheEntry> = {}): RawVariableCacheEntry {
  return {
    value: 230,
    quality: SignalQuality.Good,
    timestamp: new Date('2026-07-12T10:00:00Z'),
    ...overrides,
  };
}

describe('InMemoryRawVariableCache', () => {
  it('devuelve undefined para una Variable que nunca ha tickeado', () => {
    const cache = new InMemoryRawVariableCache();

    expect(cache.get('machine-1', 'Voltage')).toBeUndefined();
  });

  it('devuelve el último valor almacenado para (machineId, variableName)', () => {
    const cache = new InMemoryRawVariableCache();
    const entry = buildEntry();

    cache.set('machine-1', 'Voltage', entry);

    expect(cache.get('machine-1', 'Voltage')).toEqual(entry);
  });

  it('sobrescribe el registro anterior de la misma Variable', () => {
    const cache = new InMemoryRawVariableCache();
    cache.set('machine-1', 'Voltage', buildEntry({ value: 230 }));

    cache.set('machine-1', 'Voltage', buildEntry({ value: 235 }));

    expect(cache.get('machine-1', 'Voltage')).toEqual(buildEntry({ value: 235 }));
  });

  it('mantiene registros independientes por Machine, aunque el nombre de Variable se repita', () => {
    const cache = new InMemoryRawVariableCache();
    cache.set('machine-1', 'Voltage', buildEntry({ value: 230 }));
    cache.set('machine-2', 'Voltage', buildEntry({ value: 400 }));

    expect(cache.get('machine-1', 'Voltage')?.value).toBe(230);
    expect(cache.get('machine-2', 'Voltage')?.value).toBe(400);
  });

  it('mantiene registros independientes por Variable dentro de la misma Machine', () => {
    const cache = new InMemoryRawVariableCache();
    cache.set('machine-1', 'Voltage', buildEntry({ value: 230 }));
    cache.set('machine-1', 'Current', buildEntry({ value: 12 }));

    expect(cache.get('machine-1', 'Voltage')?.value).toBe(230);
    expect(cache.get('machine-1', 'Current')?.value).toBe(12);
  });
});

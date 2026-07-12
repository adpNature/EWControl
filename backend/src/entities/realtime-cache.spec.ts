import { describe, expect, it } from 'vitest';
import { InMemoryRealtimeCache, type RealtimeCacheEntry } from './realtime-cache';
import { SignalQuality } from './signal-quality.enum';

function buildEntry(overrides: Partial<RealtimeCacheEntry> = {}): RealtimeCacheEntry {
  return {
    signalId: 'signal-1',
    machineId: 'machine-1',
    companyId: 'company-1',
    value: 24.8,
    quality: SignalQuality.Good,
    timestamp: new Date('2026-07-12T10:00:00Z'),
    updatedAt: new Date('2026-07-12T10:00:00Z'),
    ...overrides,
  };
}

describe('InMemoryRealtimeCache', () => {
  it('devuelve undefined para una Signal que nunca ha recibido un valor', () => {
    const cache = new InMemoryRealtimeCache();

    expect(cache.get('unknown-signal')).toBeUndefined();
  });

  it('devuelve el último valor almacenado para una Signal', () => {
    const cache = new InMemoryRealtimeCache();
    const entry = buildEntry();

    cache.set(entry);

    expect(cache.get('signal-1')).toEqual(entry);
  });

  it('sobrescribe el registro anterior de la misma Signal (un único estado por Signal)', () => {
    const cache = new InMemoryRealtimeCache();
    cache.set(buildEntry({ value: 10 }));

    cache.set(buildEntry({ value: 20, quality: SignalQuality.Offline }));

    expect(cache.get('signal-1')).toEqual(
      buildEntry({ value: 20, quality: SignalQuality.Offline }),
    );
  });

  it('mantiene registros independientes por signalId', () => {
    const cache = new InMemoryRealtimeCache();
    cache.set(buildEntry({ signalId: 'signal-1', value: 1 }));
    cache.set(buildEntry({ signalId: 'signal-2', value: 2 }));

    expect(cache.get('signal-1')?.value).toBe(1);
    expect(cache.get('signal-2')?.value).toBe(2);
  });
});

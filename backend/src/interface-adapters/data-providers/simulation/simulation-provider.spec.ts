import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionConfig } from '../../../entities/connection-config.vo';
import { DataQuality } from '../data-quality.enum';
import type { Variable } from '../variable.vo';
import { SimulationProvider } from './simulation-provider';

const SINGLE_SIGNAL_CONFIG: ConnectionConfig = {
  seedProfile: 'test-profile',
  signals: [{ variableName: 'WindingSpeed', min: 0, max: 1200, stepMax: 15 }],
};

const MULTI_SIGNAL_CONFIG: ConnectionConfig = {
  seedProfile: 'test-profile',
  signals: [
    { variableName: 'WindingSpeed', min: 0, max: 1200, stepMax: 15 },
    { variableName: 'PieceCounter', mode: 'incremental' },
    { variableName: 'RunStop', mode: 'cycle', cycleTicks: 3 },
  ],
};

describe('SimulationProvider', () => {
  it('publica una Variable por cada signal configurada cuando está conectado', async () => {
    const provider = new SimulationProvider(MULTI_SIGNAL_CONFIG, () => 1);
    const listener = vi.fn();
    provider.subscribe(listener);
    await provider.connect();

    provider.tick();

    expect(listener).toHaveBeenCalledTimes(3);
    const names = listener.mock.calls.map(([variable]: [Variable]) => variable.name);
    expect(names).toEqual(['WindingSpeed', 'PieceCounter', 'RunStop']);
  });

  it('no publica nada si nunca se conectó', () => {
    const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
    const listener = vi.fn();
    provider.subscribe(listener);

    provider.tick();

    expect(listener).not.toHaveBeenCalled();
  });

  it('no publica nada tras desconectarse', async () => {
    const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
    const listener = vi.fn();
    provider.subscribe(listener);
    await provider.connect();
    await provider.disconnect();

    provider.tick();

    expect(listener).not.toHaveBeenCalled();
    expect(provider.isConnected()).toBe(false);
  });

  it('publica siempre con calidad GOOD', async () => {
    const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
    const listener = vi.fn();
    provider.subscribe(listener);
    await provider.connect();

    provider.tick();

    const [variable] = listener.mock.calls[0] as [Variable];
    expect(variable.quality).toBe(DataQuality.Good);
  });

  it('deja de notificar a un listener tras unsubscribe sin afectar a otros', async () => {
    const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    provider.subscribe(listenerA);
    provider.subscribe(listenerB);
    await provider.connect();

    provider.unsubscribe(listenerA);
    provider.tick();

    expect(listenerA).not.toHaveBeenCalled();
    expect(listenerB).toHaveBeenCalledTimes(1);
  });

  it('reanuda el random walk desde el último valor tras reconectar, sin reiniciar al punto medio', async () => {
    const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG, () => 1);
    const values: number[] = [];
    provider.subscribe((variable) => values.push(variable.value as number));
    await provider.connect();

    provider.tick(); // 600 (punto medio)
    provider.tick(); // 615
    await provider.disconnect();
    provider.tick(); // no debería publicar nada (desconectado)
    await provider.connect();
    provider.tick(); // 630, continuando desde 615

    expect(values).toEqual([600, 615, 630]);
  });

  describe('scheduler', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('dispara un tick cada 1000ms mientras está activo', async () => {
      const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
      const listener = vi.fn();
      provider.subscribe(listener);
      await provider.connect();

      provider.startScheduler();
      vi.advanceTimersByTime(1000);
      expect(listener).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(2000);
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('detiene la generación tras stopScheduler', async () => {
      const provider = new SimulationProvider(SINGLE_SIGNAL_CONFIG);
      const listener = vi.fn();
      provider.subscribe(listener);
      await provider.connect();

      provider.startScheduler();
      vi.advanceTimersByTime(1000);
      provider.stopScheduler();
      vi.advanceTimersByTime(5000);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

import { describe, expect, it } from 'vitest';
import { listSeedVariableNames } from './connection-config.vo';

describe('listSeedVariableNames', () => {
  it('extrae el variableName de cada SimulatorSignalSeed, cualquiera que sea su variante', () => {
    const config = {
      seedProfile: 'demo',
      signals: [
        { variableName: 'temperature', min: 0, max: 100, stepMax: 1 },
        { variableName: 'counter', mode: 'incremental' as const },
        { variableName: 'cycle', mode: 'cycle' as const, cycleTicks: 10 },
      ],
    };

    expect(listSeedVariableNames(config)).toEqual(['temperature', 'counter', 'cycle']);
  });

  it('devuelve un array vacío cuando la MachineConnection no tiene señales seed', () => {
    expect(listSeedVariableNames({ seedProfile: 'empty', signals: [] })).toEqual([]);
  });
});

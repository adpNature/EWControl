import { describe, expect, it, vi } from 'vitest';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';
import { AlarmActiveCollector } from './alarm-active.collector';

describe('AlarmActiveCollector (docs/07-observabilidad-monitorizacion.md, apartado 7.3, spec 15)', () => {
  it('cuenta los AlarmState con status ACTIVE vía el repositorio TypeORM', async () => {
    const repository = { count: vi.fn().mockResolvedValue(3) };
    const collector = new AlarmActiveCollector(repository as never);

    const total = await collector.countActive();

    expect(total).toBe(3);
    expect(repository.count).toHaveBeenCalledWith({ where: { status: AlarmStateType.Active } });
  });
});

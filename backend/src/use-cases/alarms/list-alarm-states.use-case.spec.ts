import { describe, expect, it, vi } from 'vitest';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { ListAlarmStatesUseCase } from './list-alarm-states.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const RESULT = { data: [{ id: 'state-1' }], total: 1 };

function createFakes() {
  const alarmStateRepository = { list: vi.fn().mockResolvedValue(RESULT) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { alarmStateRepository, unitOfWork };
}

describe('ListAlarmStatesUseCase', () => {
  it('acota el filtro a la Company del requester cuando es AdminCliente', async () => {
    const fakes = createFakes();
    const useCase = new ListAlarmStatesUseCase(
      fakes.alarmStateRepository as never,
      fakes.unitOfWork,
    );

    const result = await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      filter: { status: AlarmStateType.Active },
      pagination: { limit: 20, offset: 0 },
    });

    expect(result).toEqual({ data: RESULT.data, total: 1, limit: 20, offset: 0 });
    expect(fakes.alarmStateRepository.list).toHaveBeenCalledWith(
      { companyId: 'company-1', status: AlarmStateType.Active },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });

  it('no acota por Company cuando el requester es SuperAdmin', async () => {
    const fakes = createFakes();
    const useCase = new ListAlarmStatesUseCase(
      fakes.alarmStateRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({
      requester: { companyId: 'company-1', role: UserRole.SuperAdmin },
      filter: {},
      pagination: { limit: 20, offset: 0 },
    });

    expect(fakes.alarmStateRepository.list).toHaveBeenCalledWith(
      { companyId: null },
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { GetAlarmStateUseCase } from './get-alarm-state.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const ALARM_STATE = { id: 'state-1', alarmDefinitionId: 'def-1', status: 'INACTIVE' };
const HISTORY = [ALARM_STATE, { id: 'state-0', alarmDefinitionId: 'def-1', status: 'INACTIVE' }];
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(ALARM_STATE) };
  const alarmStateRepository = {
    findHistoryByAlarmDefinitionId: vi.fn().mockResolvedValue(HISTORY),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, alarmStateRepository, unitOfWork };
}

describe('GetAlarmStateUseCase', () => {
  it('devuelve el AlarmState resuelto junto al histórico completo de su AlarmDefinition', async () => {
    const fakes = createFakes();
    const useCase = new GetAlarmStateUseCase(
      fakes.resolver as never,
      fakes.alarmStateRepository as never,
      fakes.unitOfWork,
    );

    const result = await useCase.execute({ alarmStateId: 'state-1', requester: REQUESTER });

    expect(result).toEqual({ ...ALARM_STATE, history: HISTORY });
    expect(fakes.alarmStateRepository.findHistoryByAlarmDefinitionId).toHaveBeenCalledWith(
      'def-1',
      FAKE_CTX,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AlarmPriority } from '../../entities/alarm-priority.enum';
import { UserRole } from '../../entities/user-role.enum';
import { UpdateAlarmDefinitionUseCase } from './update-alarm-definition.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DEFINITION = { id: 'def-1', signalId: 'signal-1' };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const UPDATED = { ...DEFINITION, priority: AlarmPriority.Critical };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DEFINITION) };
  const alarmDefinitionRepository = { update: vi.fn().mockResolvedValue(UPDATED) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, alarmDefinitionRepository, unitOfWork };
}

describe('UpdateAlarmDefinitionUseCase', () => {
  it('actualiza la AlarmDefinition resuelta con los cambios dados', async () => {
    const fakes = createFakes();
    const useCase = new UpdateAlarmDefinitionUseCase(
      fakes.resolver as never,
      fakes.alarmDefinitionRepository as never,
      fakes.unitOfWork,
    );

    const result = await useCase.execute({
      alarmDefinitionId: 'def-1',
      requester: REQUESTER,
      changes: { priority: AlarmPriority.Critical },
    });

    expect(result).toEqual(UPDATED);
    expect(fakes.alarmDefinitionRepository.update).toHaveBeenCalledWith(
      'def-1',
      { priority: AlarmPriority.Critical },
      FAKE_CTX,
    );
  });
});

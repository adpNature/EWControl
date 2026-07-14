import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { DeactivateAlarmDefinitionUseCase } from './deactivate-alarm-definition.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DEFINITION = { id: 'def-1', signalId: 'signal-1' };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };

function createFakes() {
  const resolver = { resolveAny: vi.fn().mockResolvedValue(DEFINITION) };
  const alarmDefinitionRepository = { deactivate: vi.fn().mockResolvedValue(DEFINITION) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, alarmDefinitionRepository, unitOfWork };
}

describe('DeactivateAlarmDefinitionUseCase', () => {
  it('desactiva la AlarmDefinition resuelta', async () => {
    const fakes = createFakes();
    const useCase = new DeactivateAlarmDefinitionUseCase(
      fakes.resolver as never,
      fakes.alarmDefinitionRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({ alarmDefinitionId: 'def-1', requester: REQUESTER });

    expect(fakes.alarmDefinitionRepository.deactivate).toHaveBeenCalledWith('def-1', FAKE_CTX);
  });
});

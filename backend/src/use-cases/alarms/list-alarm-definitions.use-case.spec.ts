import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { ListAlarmDefinitionsUseCase } from './list-alarm-definitions.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const DEFINITIONS = [{ id: 'def-1' }, { id: 'def-2' }];

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue(SIGNAL) };
  const alarmDefinitionRepository = { findAllBySignalId: vi.fn().mockResolvedValue(DEFINITIONS) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, alarmDefinitionRepository, unitOfWork };
}

describe('ListAlarmDefinitionsUseCase', () => {
  it('devuelve las AlarmDefinition de la Signal resuelta', async () => {
    const fakes = createFakes();
    const useCase = new ListAlarmDefinitionsUseCase(
      fakes.resolver as never,
      fakes.alarmDefinitionRepository as never,
      fakes.unitOfWork,
    );

    const result = await useCase.execute({ signalId: 'signal-1', requester: REQUESTER });

    expect(result).toEqual(DEFINITIONS);
    expect(fakes.alarmDefinitionRepository.findAllBySignalId).toHaveBeenCalledWith(
      'signal-1',
      FAKE_CTX,
    );
  });
});

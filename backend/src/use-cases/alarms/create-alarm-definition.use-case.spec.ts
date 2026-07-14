import { describe, expect, it, vi } from 'vitest';
import { AlarmPriority } from '../../entities/alarm-priority.enum';
import { UserRole } from '../../entities/user-role.enum';
import { CreateAlarmDefinitionUseCase } from './create-alarm-definition.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const SIGNAL = { id: 'signal-1', machineId: 'machine-1', isActive: true };
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const CREATED = { id: 'def-1', signalId: 'signal-1' };

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue(SIGNAL) };
  const alarmDefinitionRepository = { create: vi.fn().mockResolvedValue(CREATED) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, alarmDefinitionRepository, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new CreateAlarmDefinitionUseCase(
    fakes.resolver as never,
    fakes.alarmDefinitionRepository as never,
    fakes.unitOfWork,
  );
}

describe('CreateAlarmDefinitionUseCase', () => {
  it('crea la AlarmDefinition sobre la Signal resuelta', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      signalId: 'signal-1',
      requester: REQUESTER,
      operator: '>',
      threshold: 80,
      priority: AlarmPriority.High,
      notifyByEmail: true,
      showOnDashboard: true,
    });

    expect(result).toEqual(CREATED);
    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('signal-1', REQUESTER, FAKE_CTX);
    expect(fakes.alarmDefinitionRepository.create).toHaveBeenCalledWith(
      {
        signalId: 'signal-1',
        operator: '>',
        threshold: 80,
        priority: AlarmPriority.High,
        notifyByEmail: true,
        showOnDashboard: true,
      },
      FAKE_CTX,
    );
  });

  it('propaga el error del resolver sin crear la regla', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveActive.mockRejectedValue(new Error('not found'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        signalId: 'missing',
        requester: REQUESTER,
        operator: '>',
        threshold: 80,
        priority: AlarmPriority.High,
        notifyByEmail: false,
        showOnDashboard: true,
      }),
    ).rejects.toThrow('not found');
    expect(fakes.alarmDefinitionRepository.create).not.toHaveBeenCalled();
  });
});

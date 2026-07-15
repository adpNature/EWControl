import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { AckAlarmStateUseCase } from './ack-alarm-state.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const NOW = new Date('2026-07-15T12:00:00Z');
const REQUESTER = { companyId: 'company-1', role: UserRole.AdminCliente };
const UNACKED_ALARM_STATE = {
  id: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  ackedAt: null,
  ackedByUserId: null,
  ackedByEmail: null,
};
const ACKED_ALARM_STATE = {
  ...UNACKED_ALARM_STATE,
  ackedAt: NOW,
  ackedByUserId: 'user-1',
  ackedByEmail: 'admin@ewcontrol.local',
};

function createFakes(alarmState: unknown = UNACKED_ALARM_STATE) {
  const resolver = {
    resolveAny: vi.fn().mockResolvedValue({ alarmState, companyId: 'company-1' }),
  };
  const alarmStateRepository = { acknowledge: vi.fn().mockResolvedValue(ACKED_ALARM_STATE) };
  const eventPublisher = { publish: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const clock = { now: vi.fn().mockReturnValue(NOW) };
  return { resolver, alarmStateRepository, eventPublisher, unitOfWork, clock };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new AckAlarmStateUseCase(
    fakes.resolver as never,
    fakes.alarmStateRepository as never,
    fakes.eventPublisher as never,
    fakes.unitOfWork,
    fakes.clock,
  );
}

describe('AckAlarmStateUseCase', () => {
  it('reconoce un AlarmState sin reconocer y publica AlarmAcked', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      alarmStateId: 'state-1',
      requester: REQUESTER,
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
    });

    expect(fakes.alarmStateRepository.acknowledge).toHaveBeenCalledWith(
      'state-1',
      { ackedAt: NOW, ackedByUserId: 'user-1', ackedByEmail: 'admin@ewcontrol.local' },
      FAKE_CTX,
    );
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('AlarmAcked', {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
      ackedAt: NOW,
    });
    expect(result).toEqual(ACKED_ALARM_STATE);
  });

  it('es idempotente: si el AlarmState ya estaba reconocido, no lo modifica ni publica de nuevo', async () => {
    const fakes = createFakes(ACKED_ALARM_STATE);
    const useCase = createUseCase(fakes);

    const result = await useCase.execute({
      alarmStateId: 'state-1',
      requester: REQUESTER,
      ackedByUserId: 'other-user',
      ackedByEmail: 'other@ewcontrol.local',
    });

    expect(fakes.alarmStateRepository.acknowledge).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
    expect(result).toEqual(ACKED_ALARM_STATE);
  });

  it('propaga el error de aislamiento multiempresa del resolver (404, nunca 403)', async () => {
    const fakes = createFakes();
    const notFoundError = new Error('ALARM_STATE_NOT_FOUND');
    fakes.resolver.resolveAny.mockRejectedValue(notFoundError);
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        alarmStateId: 'missing',
        requester: REQUESTER,
        ackedByUserId: 'user-1',
        ackedByEmail: 'admin@ewcontrol.local',
      }),
    ).rejects.toBe(notFoundError);
    expect(fakes.alarmStateRepository.acknowledge).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { EvaluateAlarmRulesUseCase } from './evaluate-alarm-rules.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DEFINITION = {
  id: 'def-1',
  signalId: 'signal-1',
  operator: '>' as const,
  threshold: 80,
  priority: 'HIGH' as const,
  notifyByEmail: true,
  showOnDashboard: true,
  isActive: true,
};

function createFakes() {
  const alarmDefinitionRepository = {
    findActiveBySignalId: vi.fn().mockResolvedValue([DEFINITION]),
  };
  const alarmStateRepository = {
    findCurrentByAlarmDefinitionId: vi.fn().mockResolvedValue(null),
    createActivation: vi.fn().mockResolvedValue({ id: 'state-1' }),
    resolveActivation: vi.fn().mockResolvedValue({ id: 'state-1' }),
  };
  const eventPublisher = { publish: vi.fn() };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { alarmDefinitionRepository, alarmStateRepository, eventPublisher, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new EvaluateAlarmRulesUseCase(
    fakes.alarmDefinitionRepository as never,
    fakes.alarmStateRepository as never,
    fakes.eventPublisher as never,
    fakes.unitOfWork,
  );
}

const BASE_INPUT = {
  signalId: 'signal-1',
  companyId: 'company-1',
  quality: SignalQuality.Good,
  timestamp: new Date('2026-01-01T00:00:00Z'),
};

describe('EvaluateAlarmRulesUseCase', () => {
  it('activa la alarma cuando la condición se cumple y no había AlarmState vigente', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 84 });

    expect(fakes.alarmStateRepository.createActivation).toHaveBeenCalledWith(
      {
        alarmDefinitionId: 'def-1',
        signalId: 'signal-1',
        priority: 'HIGH',
        activatedAt: BASE_INPUT.timestamp,
      },
      FAKE_CTX,
    );
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('AlarmTriggered', {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      priority: 'HIGH',
      timestamp: BASE_INPUT.timestamp,
    });
  });

  it('no genera un nuevo AlarmTriggered mientras la alarma ya está ACTIVE (evita duplicados)', async () => {
    const fakes = createFakes();
    fakes.alarmStateRepository.findCurrentByAlarmDefinitionId.mockResolvedValue({
      id: 'state-1',
      status: AlarmStateType.Active,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 86 });

    expect(fakes.alarmStateRepository.createActivation).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('resuelve la alarma (AlarmCleared) cuando la condición deja de cumplirse y estaba ACTIVE', async () => {
    const fakes = createFakes();
    fakes.alarmStateRepository.findCurrentByAlarmDefinitionId.mockResolvedValue({
      id: 'state-1',
      status: AlarmStateType.Active,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 75 });

    expect(fakes.alarmStateRepository.resolveActivation).toHaveBeenCalledWith(
      'state-1',
      BASE_INPUT.timestamp,
      FAKE_CTX,
    );
    expect(fakes.eventPublisher.publish).toHaveBeenCalledWith('AlarmCleared', {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      timestamp: BASE_INPUT.timestamp,
    });
  });

  it('no hace nada si la condición no se cumple y ya estaba INACTIVE', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 75 });

    expect(fakes.alarmStateRepository.createActivation).not.toHaveBeenCalled();
    expect(fakes.alarmStateRepository.resolveActivation).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('con calidad distinta de GOOD no evalúa ninguna regla (ni siquiera consulta el repositorio)', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 84, quality: SignalQuality.Bad });

    expect(fakes.alarmDefinitionRepository.findActiveBySignalId).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('descarta silenciosamente una definición cuyo operador es numérico y el value no lo es', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 'FAULT' });

    expect(fakes.alarmStateRepository.findCurrentByAlarmDefinitionId).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });

  it('solo evalúa las AlarmDefinition activas (findActiveBySignalId ya excluye las desactivadas)', async () => {
    const fakes = createFakes();
    fakes.alarmDefinitionRepository.findActiveBySignalId.mockResolvedValue([]);
    const useCase = createUseCase(fakes);

    await useCase.execute({ ...BASE_INPUT, value: 84 });

    expect(fakes.alarmStateRepository.createActivation).not.toHaveBeenCalled();
    expect(fakes.eventPublisher.publish).not.toHaveBeenCalled();
  });
});

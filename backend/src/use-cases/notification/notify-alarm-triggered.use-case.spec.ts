import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { NotifyAlarmTriggeredUseCase } from './notify-alarm-triggered.use-case';

const FAKE_CTX = Symbol('tx-ctx');
const DEFINITION = { id: 'def-1', threshold: 80, notifyByEmail: true };
const SIGNAL = { id: 'signal-1', name: 'Temperatura', machineId: 'machine-1' };
const MACHINE = { id: 'machine-1', name: 'Prensa 01', companyId: 'company-1' };
const COMPANY = { id: 'company-1', name: 'Metalúrgica López' };
const RECIPIENTS = [{ email: 'admin1@ewcontrol.local' }, { email: 'admin2@ewcontrol.local' }];

const PAYLOAD = {
  alarmStateId: 'state-1',
  alarmDefinitionId: 'def-1',
  signalId: 'signal-1',
  companyId: 'company-1',
  priority: 'HIGH' as const,
  value: 84,
  timestamp: new Date('2026-07-13T10:00:00Z'),
};

function createFakes() {
  const alarmDefinitionRepository = { findById: vi.fn().mockResolvedValue(DEFINITION) };
  const signalRepository = { findById: vi.fn().mockResolvedValue(SIGNAL) };
  const machineRepository = { findById: vi.fn().mockResolvedValue(MACHINE) };
  const companyRepository = { findById: vi.fn().mockResolvedValue(COMPANY) };
  const userRepository = { findActiveByCompanyAndRole: vi.fn().mockResolvedValue(RECIPIENTS) };
  const emailSender = { send: vi.fn().mockResolvedValue(undefined) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return {
    alarmDefinitionRepository,
    signalRepository,
    machineRepository,
    companyRepository,
    userRepository,
    emailSender,
    unitOfWork,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new NotifyAlarmTriggeredUseCase(
    fakes.alarmDefinitionRepository as never,
    fakes.signalRepository as never,
    fakes.machineRepository as never,
    fakes.companyRepository as never,
    fakes.userRepository as never,
    fakes.emailSender as never,
    fakes.unitOfWork,
  );
}

describe('NotifyAlarmTriggeredUseCase', () => {
  it('envía el email a los AdminCliente activos de la Company con el contenido esperado', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);

    await useCase.execute(PAYLOAD);

    expect(fakes.userRepository.findActiveByCompanyAndRole).toHaveBeenCalledWith(
      'company-1',
      UserRole.AdminCliente,
      FAKE_CTX,
    );
    expect(fakes.emailSender.send).toHaveBeenCalledWith({
      to: ['admin1@ewcontrol.local', 'admin2@ewcontrol.local'],
      subject: expect.stringContaining('Temperatura'),
      text: expect.stringContaining('Metalúrgica López'),
    });
  });

  it('no envía nada si la AlarmDefinition tiene notifyByEmail en false', async () => {
    const fakes = createFakes();
    fakes.alarmDefinitionRepository.findById.mockResolvedValue({
      ...DEFINITION,
      notifyByEmail: false,
    });
    const useCase = createUseCase(fakes);

    await useCase.execute(PAYLOAD);

    expect(fakes.emailSender.send).not.toHaveBeenCalled();
  });

  it('no envía nada si la AlarmDefinition ya no existe', async () => {
    const fakes = createFakes();
    fakes.alarmDefinitionRepository.findById.mockResolvedValue(null);
    const useCase = createUseCase(fakes);

    await useCase.execute(PAYLOAD);

    expect(fakes.emailSender.send).not.toHaveBeenCalled();
  });

  it('no envía nada si no hay AdminCliente activos en la Company', async () => {
    const fakes = createFakes();
    fakes.userRepository.findActiveByCompanyAndRole.mockResolvedValue([]);
    const useCase = createUseCase(fakes);

    await useCase.execute(PAYLOAD);

    expect(fakes.emailSender.send).not.toHaveBeenCalled();
  });

  it('un fallo de emailSender.send se registra sin relanzar (criterio de aceptación 6)', async () => {
    const fakes = createFakes();
    fakes.emailSender.send.mockRejectedValue(new Error('SMTP down'));
    const useCase = createUseCase(fakes);

    await expect(useCase.execute(PAYLOAD)).resolves.toBeUndefined();
  });
});

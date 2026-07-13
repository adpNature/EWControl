import { Inject, Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../../entities/user-role.enum';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from '../alarms/ports/alarm-definition-repository.port';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import type { AlarmTriggeredPayload } from '../simulator-control/ports/event-publisher.port';
import { buildAlarmEmail } from './build-alarm-email';
import { EMAIL_SENDER, type IEmailSender } from './ports/email-sender.port';
import { shouldNotifyAlarmEvent } from './should-notify-alarm-event';

/**
 * Notification Service (Documento 2, apartado 2.10), wiring real de
 * docs/specs/09-alarmas.md: reacciona a `AlarmTriggered` (vía
 * `AlarmTriggeredNotificationListener`), resuelve nombres y destinatarios, y
 * envía el email de forma asíncrona. Un fallo de envío (o de resolución de
 * datos) se registra y nunca se relanza — no debe interrumpir el
 * procesamiento de Signals ni reevaluar la alarma (criterio de aceptación 6).
 */
@Injectable()
export class NotifyAlarmTriggeredUseCase {
  private readonly logger = new Logger(NotifyAlarmTriggeredUseCase.name);

  constructor(
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(payload: AlarmTriggeredPayload): Promise<void> {
    try {
      const resolved = await this.unitOfWork.runInTransaction(async (ctx) => {
        const definition = await this.alarmDefinitionRepository.findById(
          payload.alarmDefinitionId,
          ctx,
        );
        if (!definition || !shouldNotifyAlarmEvent(definition.notifyByEmail, 'AlarmTriggered')) {
          return null;
        }
        const signal = await this.signalRepository.findById(payload.signalId, ctx);
        const machine = signal
          ? await this.machineRepository.findById(signal.machineId, ctx)
          : null;
        const company = machine
          ? await this.companyRepository.findById(machine.companyId, ctx)
          : null;
        if (!signal || !machine || !company) {
          return null;
        }
        const recipients = await this.userRepository.findActiveByCompanyAndRole(
          machine.companyId,
          UserRole.AdminCliente,
          ctx,
        );
        if (recipients.length === 0) {
          return null;
        }
        return { definition, signal, machine, company, recipients };
      });

      if (!resolved) {
        return;
      }

      const email = buildAlarmEmail({
        companyName: resolved.company.name,
        machineName: resolved.machine.name,
        signalName: resolved.signal.name,
        value: payload.value,
        threshold: resolved.definition.threshold,
        timestamp: payload.timestamp,
      });
      await this.emailSender.send({
        to: resolved.recipients.map((user) => user.email),
        subject: email.subject,
        text: email.text,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar por email la alarma ${payload.alarmDefinitionId}: ${(error as Error).message}`,
      );
    }
  }
}

import { Module } from '@nestjs/common';
import { AlarmEvaluationListener } from '../interface-adapters/events/alarm-evaluation.listener';
import { AlarmTriggeredNotificationListener } from '../interface-adapters/events/alarm-triggered-notification.listener';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { NodemailerEmailSenderAdapter } from '../interface-adapters/email/nodemailer-email-sender.adapter';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { AlarmDefinitionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/alarm-definition.typeorm-repository';
import { AlarmStateTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/alarm-state.typeorm-repository';
import { CompanyTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/company.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { UserTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/user.typeorm-repository';
import { AlarmDefinitionController } from '../interface-adapters/rest/alarms/alarm-definition.controller';
import { AlarmDefinitionMutationController } from '../interface-adapters/rest/alarms/alarm-definition-mutation.controller';
import { AlarmStateController } from '../interface-adapters/rest/alarms/alarm-state.controller';
import { AckAlarmStateUseCase } from '../use-cases/alarms/ack-alarm-state.use-case';
import { AlarmDefinitionAccessResolver } from '../use-cases/alarms/alarm-definition-access.resolver';
import { AlarmStateAccessResolver } from '../use-cases/alarms/alarm-state-access.resolver';
import { CreateAlarmDefinitionUseCase } from '../use-cases/alarms/create-alarm-definition.use-case';
import { DeactivateAlarmDefinitionUseCase } from '../use-cases/alarms/deactivate-alarm-definition.use-case';
import { EvaluateAlarmRulesUseCase } from '../use-cases/alarms/evaluate-alarm-rules.use-case';
import { GetAlarmStateUseCase } from '../use-cases/alarms/get-alarm-state.use-case';
import { ListAlarmDefinitionsUseCase } from '../use-cases/alarms/list-alarm-definitions.use-case';
import { ListAlarmStatesUseCase } from '../use-cases/alarms/list-alarm-states.use-case';
import { NotifyAlarmTriggeredUseCase } from '../use-cases/notification/notify-alarm-triggered.use-case';
import { EMAIL_SENDER } from '../use-cases/notification/ports/email-sender.port';
import { ALARM_DEFINITION_REPOSITORY } from '../use-cases/alarms/ports/alarm-definition-repository.port';
import { ALARM_STATE_REPOSITORY } from '../use-cases/alarms/ports/alarm-state-repository.port';
import { SignalAccessResolver } from '../use-cases/alarms/signal-access.resolver';
import { UpdateAlarmDefinitionUseCase } from '../use-cases/alarms/update-alarm-definition.use-case';
import { COMPANY_REPOSITORY } from '../use-cases/seed-demo-environment/ports/company-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { USER_REPOSITORY } from '../use-cases/seed-demo-environment/ports/user-repository.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { NODEMAILER_TRANSPORTER, createNodemailerTransporter } from './email/nodemailer.client';

/**
 * Wiring de docs/specs/09-alarmas.md, mismo estilo que `machine-management.module.ts`.
 * Incluye el Notification Service (email) en este mismo módulo, no en uno separado
 * — no hay hoy otro evento/consumidor que justifique separarlo.
 */
@Module({
  controllers: [AlarmDefinitionController, AlarmDefinitionMutationController, AlarmStateController],
  providers: [
    SignalAccessResolver,
    AlarmDefinitionAccessResolver,
    AlarmStateAccessResolver,
    CreateAlarmDefinitionUseCase,
    ListAlarmDefinitionsUseCase,
    UpdateAlarmDefinitionUseCase,
    DeactivateAlarmDefinitionUseCase,
    EvaluateAlarmRulesUseCase,
    GetAlarmStateUseCase,
    ListAlarmStatesUseCase,
    AckAlarmStateUseCase,
    NotifyAlarmTriggeredUseCase,
    AlarmEvaluationListener,
    AlarmTriggeredNotificationListener,
    { provide: ALARM_DEFINITION_REPOSITORY, useClass: AlarmDefinitionTypeOrmRepository },
    { provide: ALARM_STATE_REPOSITORY, useClass: AlarmStateTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: COMPANY_REPOSITORY, useClass: CompanyTypeOrmRepository },
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: NODEMAILER_TRANSPORTER, useFactory: createNodemailerTransporter },
    { provide: EMAIL_SENDER, useClass: NodemailerEmailSenderAdapter },
  ],
})
export class AlarmsModule {}

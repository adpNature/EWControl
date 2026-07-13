import { Module } from '@nestjs/common';
import { AlarmDefinitionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/alarm-definition.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { AlarmDefinitionController } from '../interface-adapters/rest/alarms/alarm-definition.controller';
import { AlarmDefinitionMutationController } from '../interface-adapters/rest/alarms/alarm-definition-mutation.controller';
import { AlarmDefinitionAccessResolver } from '../use-cases/alarms/alarm-definition-access.resolver';
import { CreateAlarmDefinitionUseCase } from '../use-cases/alarms/create-alarm-definition.use-case';
import { DeactivateAlarmDefinitionUseCase } from '../use-cases/alarms/deactivate-alarm-definition.use-case';
import { ListAlarmDefinitionsUseCase } from '../use-cases/alarms/list-alarm-definitions.use-case';
import { ALARM_DEFINITION_REPOSITORY } from '../use-cases/alarms/ports/alarm-definition-repository.port';
import { SignalAccessResolver } from '../use-cases/alarms/signal-access.resolver';
import { UpdateAlarmDefinitionUseCase } from '../use-cases/alarms/update-alarm-definition.use-case';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';

/**
 * Wiring de docs/specs/09-alarmas.md, mismo estilo que `machine-management.module.ts`.
 * Crece en slices sucesivos de la misma spec: el Alarm Engine (evaluación +
 * listener de `SignalUpdated`), la lectura de `AlarmState` y el Notification
 * Service se añaden a este mismo módulo, no a módulos separados.
 */
@Module({
  controllers: [AlarmDefinitionController, AlarmDefinitionMutationController],
  providers: [
    SignalAccessResolver,
    AlarmDefinitionAccessResolver,
    CreateAlarmDefinitionUseCase,
    ListAlarmDefinitionsUseCase,
    UpdateAlarmDefinitionUseCase,
    DeactivateAlarmDefinitionUseCase,
    { provide: ALARM_DEFINITION_REPOSITORY, useClass: AlarmDefinitionTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
})
export class AlarmsModule {}

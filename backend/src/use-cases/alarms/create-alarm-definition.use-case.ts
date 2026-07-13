import { Inject, Injectable } from '@nestjs/common';
import { AlarmDefinition } from '../../entities/alarm-definition.entity';
import type { AlarmOperator } from '../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../entities/alarm-priority.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';
import { Requester, SignalAccessResolver } from './signal-access.resolver';

export type CreateAlarmDefinitionInput = {
  signalId: string;
  requester: Requester;
  operator: AlarmOperator;
  threshold: number | boolean | string;
  priority: AlarmPriority;
  notifyByEmail: boolean;
  showOnDashboard: boolean;
};

/**
 * docs/specs/09-alarmas.md, backend: `POST /signals/:signalId/alarm-definitions`.
 * Se permite crear una regla sobre una Signal `FORMULA` (no se bloquea aquí):
 * nunca evaluará porque nunca recibe ticks del Signal Engine, mismo criterio
 * que la spec 08 aplicó a sus históricos.
 */
@Injectable()
export class CreateAlarmDefinitionUseCase {
  constructor(
    private readonly resolver: SignalAccessResolver,
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateAlarmDefinitionInput): Promise<AlarmDefinition> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const signal = await this.resolver.resolveActive(input.signalId, input.requester, ctx);
      return this.alarmDefinitionRepository.create(
        {
          signalId: signal.id,
          operator: input.operator,
          threshold: input.threshold,
          priority: input.priority,
          notifyByEmail: input.notifyByEmail,
          showOnDashboard: input.showOnDashboard,
        },
        ctx,
      );
    });
  }
}

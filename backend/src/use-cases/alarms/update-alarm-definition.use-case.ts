import { Inject, Injectable } from '@nestjs/common';
import { AlarmDefinition } from '../../entities/alarm-definition.entity';
import type { AlarmOperator } from '../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../entities/alarm-priority.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { AlarmDefinitionAccessResolver, Requester } from './alarm-definition-access.resolver';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';

export type UpdateAlarmDefinitionInput = {
  alarmDefinitionId: string;
  requester: Requester;
  changes: Partial<{
    operator: AlarmOperator;
    threshold: number | boolean | string;
    priority: AlarmPriority;
    notifyByEmail: boolean;
    showOnDashboard: boolean;
  }>;
};

/** docs/specs/09-alarmas.md, backend: `PATCH /alarm-definitions/:id`. `signalId` es inmutable. */
@Injectable()
export class UpdateAlarmDefinitionUseCase {
  constructor(
    private readonly resolver: AlarmDefinitionAccessResolver,
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateAlarmDefinitionInput): Promise<AlarmDefinition> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const definition = await this.resolver.resolveAny(
        input.alarmDefinitionId,
        input.requester,
        ctx,
      );
      return this.alarmDefinitionRepository.update(definition.id, input.changes, ctx);
    });
  }
}

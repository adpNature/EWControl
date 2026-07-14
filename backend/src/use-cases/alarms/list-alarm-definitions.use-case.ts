import { Inject, Injectable } from '@nestjs/common';
import { AlarmDefinition } from '../../entities/alarm-definition.entity';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';
import { Requester, SignalAccessResolver } from './signal-access.resolver';

export type ListAlarmDefinitionsInput = { signalId: string; requester: Requester };

/** docs/specs/09-alarmas.md, backend: `GET /signals/:signalId/alarm-definitions` (incluye reglas inactivas). */
@Injectable()
export class ListAlarmDefinitionsUseCase {
  constructor(
    private readonly resolver: SignalAccessResolver,
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: ListAlarmDefinitionsInput): Promise<AlarmDefinition[]> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const signal = await this.resolver.resolveActive(input.signalId, input.requester, ctx);
      return this.alarmDefinitionRepository.findAllBySignalId(signal.id, ctx);
    });
  }
}

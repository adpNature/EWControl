import { Inject, Injectable } from '@nestjs/common';
import { AlarmState } from '../../entities/alarm-state.entity';
import { AlarmPriority } from '../../entities/alarm-priority.enum';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester } from './alarm-state-access.resolver';
import {
  ALARM_STATE_REPOSITORY,
  type IAlarmStateRepository,
} from './ports/alarm-state-repository.port';

export type ListAlarmStatesInput = {
  requester: Requester;
  filter: { status?: AlarmStateType; machineId?: string; priority?: AlarmPriority };
  pagination: { limit: number; offset: number };
};
export type ListAlarmStatesResult = {
  data: AlarmState[];
  total: number;
  limit: number;
  offset: number;
};

/** docs/specs/09-alarmas.md, backend: `GET /alarm-states`, filtrado y acotado a la Company del requester. */
@Injectable()
export class ListAlarmStatesUseCase {
  constructor(
    @Inject(ALARM_STATE_REPOSITORY) private readonly alarmStateRepository: IAlarmStateRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListAlarmStatesInput): Promise<ListAlarmStatesResult> {
    const companyId =
      input.requester.role === UserRole.SuperAdmin ? null : input.requester.companyId;
    const { data, total } = await this.unitOfWork.runInTransaction((ctx) =>
      this.alarmStateRepository.list({ companyId, ...input.filter }, input.pagination, ctx),
    );
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}

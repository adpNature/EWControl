import { Inject, Injectable } from '@nestjs/common';
import { AlarmState } from '../../entities/alarm-state.entity';
import { AlarmStateAccessResolver, Requester } from './alarm-state-access.resolver';
import {
  ALARM_STATE_REPOSITORY,
  type IAlarmStateRepository,
} from './ports/alarm-state-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type GetAlarmStateInput = { alarmStateId: string; requester: Requester };
export type GetAlarmStateResult = AlarmState & { history: AlarmState[] };

/**
 * docs/specs/09-alarmas.md, backend: `GET /alarm-states/:id`. Devuelve el
 * histórico completo (ordenado por `activatedAt` descendente) de la
 * `AlarmDefinition` del AlarmState pedido — el primer elemento es el vigente
 * (Documento 3, apartado 3.2.7, Regla 3).
 */
@Injectable()
export class GetAlarmStateUseCase {
  constructor(
    private readonly resolver: AlarmStateAccessResolver,
    @Inject(ALARM_STATE_REPOSITORY) private readonly alarmStateRepository: IAlarmStateRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetAlarmStateInput): Promise<GetAlarmStateResult> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const alarmState = await this.resolver.resolveAny(input.alarmStateId, input.requester, ctx);
      const history = await this.alarmStateRepository.findHistoryByAlarmDefinitionId(
        alarmState.alarmDefinitionId,
        ctx,
      );
      return { ...alarmState, history };
    });
  }
}

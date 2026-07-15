import { Inject, Injectable } from '@nestjs/common';
import { AlarmState } from '../../entities/alarm-state.entity';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';
import { AlarmStateAccessResolver, Requester } from './alarm-state-access.resolver';
import {
  ALARM_STATE_REPOSITORY,
  type IAlarmStateRepository,
} from './ports/alarm-state-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type AckAlarmStateInput = {
  alarmStateId: string;
  requester: Requester;
  ackedByUserId: string;
  ackedByEmail: string;
};

/**
 * Reconocimiento manual de alarmas (ACK, docs/specs/11-ack-alarmas.md): fija
 * `ackedAt`/`ackedByUserId`/`ackedByEmail` de un AlarmState existente sin
 * alterar su ciclo de vida (`status`/`activatedAt`/`resolvedAt`, propiedad
 * exclusiva del Alarm Engine). Idempotente: si ya estaba reconocido, no lo
 * sobreescribe ni vuelve a publicar `AlarmAcked` (se preserva quién lo
 * reconoció primero).
 */
@Injectable()
export class AckAlarmStateUseCase {
  constructor(
    private readonly resolver: AlarmStateAccessResolver,
    @Inject(ALARM_STATE_REPOSITORY) private readonly alarmStateRepository: IAlarmStateRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: AckAlarmStateInput): Promise<AlarmState> {
    const result = await this.unitOfWork.runInTransaction(async (ctx) => {
      const { alarmState, companyId } = await this.resolver.resolveAny(
        input.alarmStateId,
        input.requester,
        ctx,
      );
      if (alarmState.ackedAt) {
        return { alarmState, companyId, changed: false };
      }
      const acked = await this.alarmStateRepository.acknowledge(
        alarmState.id,
        {
          ackedAt: this.clock.now(),
          ackedByUserId: input.ackedByUserId,
          ackedByEmail: input.ackedByEmail,
        },
        ctx,
      );
      return { alarmState: acked, companyId, changed: true };
    });

    if (result.changed) {
      this.eventPublisher.publish('AlarmAcked', {
        alarmStateId: result.alarmState.id,
        alarmDefinitionId: result.alarmState.alarmDefinitionId,
        signalId: result.alarmState.signalId,
        companyId: result.companyId,
        ackedByUserId: result.alarmState.ackedByUserId!,
        ackedByEmail: result.alarmState.ackedByEmail!,
        ackedAt: result.alarmState.ackedAt!,
      });
    }

    return result.alarmState;
  }
}

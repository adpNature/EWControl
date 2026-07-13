import { Inject, Injectable } from '@nestjs/common';
import { evaluateAlarmCondition } from '../../entities/alarm-engine';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';
import { SignalQuality } from '../../entities/signal-quality.enum';
import {
  type AlarmClearedPayload,
  type AlarmTriggeredPayload,
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';
import {
  ALARM_STATE_REPOSITORY,
  type IAlarmStateRepository,
} from './ports/alarm-state-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type EvaluateAlarmRulesInput = {
  signalId: string;
  companyId: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

type CollectedEvent =
  | { eventName: 'AlarmTriggered'; payload: AlarmTriggeredPayload }
  | { eventName: 'AlarmCleared'; payload: AlarmClearedPayload };

/**
 * Alarm Engine (Documento 2, apartado 2.8), wiring real de docs/specs/09-alarmas.md:
 * reacciona a `SignalUpdated` (vía `AlarmEvaluationListener`), evalúa únicamente
 * las `AlarmDefinition` activas de la Signal que cambió, y mantiene el
 * `AlarmState` vigente de cada una, evitando duplicados (Documento 2, apartado
 * 2.8, "Alarmas Duplicadas"). Nunca envía notificaciones — solo publica eventos
 * (Regla 5); el Notification Service reacciona a ellos por separado.
 */
@Injectable()
export class EvaluateAlarmRulesUseCase {
  constructor(
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(ALARM_STATE_REPOSITORY) private readonly alarmStateRepository: IAlarmStateRepository,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: EvaluateAlarmRulesInput): Promise<void> {
    if (input.quality !== SignalQuality.Good) {
      return;
    }

    const events = await this.unitOfWork.runInTransaction<CollectedEvent[]>(async (ctx) => {
      const definitions = await this.alarmDefinitionRepository.findActiveBySignalId(
        input.signalId,
        ctx,
      );
      const collected: CollectedEvent[] = [];

      for (const definition of definitions) {
        const satisfied = evaluateAlarmCondition({
          operator: definition.operator,
          threshold: definition.threshold,
          value: input.value,
        });
        if (satisfied === undefined) {
          continue;
        }

        const current = await this.alarmStateRepository.findCurrentByAlarmDefinitionId(
          definition.id,
          ctx,
        );
        const isActive = current?.status === AlarmStateType.Active;

        if (satisfied && !isActive) {
          const created = await this.alarmStateRepository.createActivation(
            {
              alarmDefinitionId: definition.id,
              signalId: input.signalId,
              priority: definition.priority,
              activatedAt: input.timestamp,
            },
            ctx,
          );
          collected.push({
            eventName: 'AlarmTriggered',
            payload: {
              alarmStateId: created.id,
              alarmDefinitionId: definition.id,
              signalId: input.signalId,
              companyId: input.companyId,
              priority: definition.priority,
              timestamp: input.timestamp,
            },
          });
        } else if (!satisfied && isActive && current) {
          const resolved = await this.alarmStateRepository.resolveActivation(
            current.id,
            input.timestamp,
            ctx,
          );
          collected.push({
            eventName: 'AlarmCleared',
            payload: {
              alarmStateId: resolved.id,
              alarmDefinitionId: definition.id,
              signalId: input.signalId,
              companyId: input.companyId,
              timestamp: input.timestamp,
            },
          });
        }
      }

      return collected;
    });

    for (const event of events) {
      if (event.eventName === 'AlarmTriggered') {
        this.eventPublisher.publish('AlarmTriggered', event.payload);
      } else {
        this.eventPublisher.publish('AlarmCleared', event.payload);
      }
    }
  }
}

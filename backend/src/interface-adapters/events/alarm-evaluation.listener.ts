import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SignalUpdatedPayload } from '../../use-cases/simulator-control/ports/event-publisher.port';
import { EvaluateAlarmRulesUseCase } from '../../use-cases/alarms/evaluate-alarm-rules.use-case';

/**
 * docs/specs/09-alarmas.md: el Alarm Engine reacciona a `SignalUpdated`
 * (Documento 2, apartado 2.8), mismo patrón `@OnEvent` que
 * `MachineDisconnectedListener` (primer listener del proyecto).
 */
@Injectable()
export class AlarmEvaluationListener {
  private readonly logger = new Logger(AlarmEvaluationListener.name);

  constructor(private readonly evaluateAlarmRules: EvaluateAlarmRulesUseCase) {}

  @OnEvent('SignalUpdated')
  handle(payload: SignalUpdatedPayload): Promise<void> {
    this.logger.debug({
      correlationId: payload.correlationId,
      signalId: payload.signalId,
      msg: 'Evaluando AlarmDefinitions para SignalUpdated',
    });
    return this.evaluateAlarmRules.execute({
      signalId: payload.signalId,
      companyId: payload.companyId,
      value: payload.value,
      quality: payload.quality,
      timestamp: payload.timestamp,
    });
  }
}

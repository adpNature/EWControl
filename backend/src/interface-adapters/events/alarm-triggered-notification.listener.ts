import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AlarmTriggeredPayload } from '../../use-cases/simulator-control/ports/event-publisher.port';
import { NotifyAlarmTriggeredUseCase } from '../../use-cases/notification/notify-alarm-triggered.use-case';

/**
 * docs/specs/09-alarmas.md: el Notification Service solo reacciona a
 * `AlarmTriggered` — no existe listener de `AlarmCleared` a propósito
 * (Documento 2, apartado 2.10, "Frecuencia de Envío": nunca notifica en la
 * resolución). Mismo patrón `@OnEvent` que `MachineDisconnectedListener`.
 */
@Injectable()
export class AlarmTriggeredNotificationListener {
  constructor(private readonly notifyAlarmTriggered: NotifyAlarmTriggeredUseCase) {}

  @OnEvent('AlarmTriggered')
  handle(payload: AlarmTriggeredPayload): Promise<void> {
    return this.notifyAlarmTriggered.execute(payload);
  }
}

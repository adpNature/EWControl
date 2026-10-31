import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AlarmAckedPayload,
  AlarmClearedPayload,
  AlarmTriggeredPayload,
  IEventPublisher,
  MachineConnectedPayload,
  MachineConnectionReplacedPayload,
  MachineDeactivatedPayload,
  MachineDisconnectedPayload,
  MachineSignalsChangedPayload,
  WritePackageExecutedPayload,
  SignalUpdatedPayload,
} from '../../use-cases/simulator-control/ports/event-publisher.port';

/**
 * Implementación del Event Publisher (Documento 2, apartado 2.7) que envuelve
 * `EventEmitter2` de NestJS. Es la única clase del proyecto autorizada a usarlo directamente.
 */
@Injectable()
export class NestEventEmitterPublisher implements IEventPublisher {
  constructor(private readonly emitter: EventEmitter2) {}

  publish(eventName: 'MachineConnected', payload: MachineConnectedPayload): void;
  publish(eventName: 'MachineDisconnected', payload: MachineDisconnectedPayload): void;
  publish(eventName: 'SignalUpdated', payload: SignalUpdatedPayload): void;
  publish(eventName: 'AlarmTriggered', payload: AlarmTriggeredPayload): void;
  publish(eventName: 'AlarmCleared', payload: AlarmClearedPayload): void;
  publish(eventName: 'AlarmAcked', payload: AlarmAckedPayload): void;
  publish(eventName: 'MachineConnectionReplaced', payload: MachineConnectionReplacedPayload): void;
  publish(eventName: 'MachineDeactivated', payload: MachineDeactivatedPayload): void;
  publish(eventName: 'MachineSignalsChanged', payload: MachineSignalsChangedPayload): void;
  publish(eventName: 'WritePackageExecuted', payload: WritePackageExecutedPayload): void;
  publish(
    eventName:
      | 'MachineConnected'
      | 'MachineDisconnected'
      | 'SignalUpdated'
      | 'AlarmTriggered'
      | 'AlarmCleared'
      | 'AlarmAcked'
      | 'MachineConnectionReplaced'
      | 'MachineDeactivated'
      | 'MachineSignalsChanged'
      | 'WritePackageExecuted',
    payload:
      | MachineConnectedPayload
      | MachineDisconnectedPayload
      | SignalUpdatedPayload
      | AlarmTriggeredPayload
      | AlarmClearedPayload
      | AlarmAckedPayload
      | MachineConnectionReplacedPayload
      | MachineDeactivatedPayload
      | MachineSignalsChangedPayload
      | WritePackageExecutedPayload,
  ): void {
    this.emitter.emit(eventName, payload);
  }
}

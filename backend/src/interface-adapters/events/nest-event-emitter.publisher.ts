import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IEventPublisher,
  MachineConnectedPayload,
  MachineDisconnectedPayload,
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
  publish(
    eventName: 'MachineConnected' | 'MachineDisconnected' | 'SignalUpdated',
    payload: MachineConnectedPayload | MachineDisconnectedPayload | SignalUpdatedPayload,
  ): void {
    this.emitter.emit(eventName, payload);
  }
}

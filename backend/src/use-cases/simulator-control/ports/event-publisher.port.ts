import type { AlarmPriority } from '../../../entities/alarm-priority.enum';
import type { SignalQuality } from '../../../entities/signal-quality.enum';

export const EVENT_PUBLISHER = Symbol('EventPublisher');

/**
 * Eventos de dominio relevantes para esta spec (Documento 2, apartado 2.7,
 * "Eventos Principales"). Se amplía a medida que otras specs necesiten publicar
 * eventos nuevos. `companyId` se añade en docs/specs/07-dashboard-tiempo-real.md
 * para que el WebSocket Gateway pueda enrutar cada evento a la sala de su Company.
 */
export type MachineConnectedPayload = { machineId: string; companyId: string; timestamp: Date };
export type MachineDisconnectedPayload = { machineId: string; companyId: string; timestamp: Date };
export type SignalUpdatedPayload = {
  signalId: string;
  machineId: string;
  companyId: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};
/**
 * docs/specs/09-alarmas.md, docs/11-api-rest.md sección "Eventos WebSocket".
 * `value` es de uso interno (Notification Service, contenido del email —
 * Documento 2, apartado 2.10): el Gateway lo omite deliberadamente al
 * reemitir por WebSocket, cuyo contrato ya está catalogado sin ese campo.
 */
export type AlarmTriggeredPayload = {
  alarmStateId: string;
  alarmDefinitionId: string;
  signalId: string;
  companyId: string;
  priority: AlarmPriority;
  value: number | boolean | string;
  timestamp: Date;
};
export type AlarmClearedPayload = {
  alarmStateId: string;
  alarmDefinitionId: string;
  signalId: string;
  companyId: string;
  timestamp: Date;
};
/** docs/specs/11-ack-alarmas.md, docs/11-api-rest.md sección "Eventos WebSocket". */
export type AlarmAckedPayload = {
  alarmStateId: string;
  alarmDefinitionId: string;
  signalId: string;
  companyId: string;
  ackedByUserId: string;
  ackedByEmail: string;
  ackedAt: Date;
};

/**
 * Único punto por el que el dominio/aplicación publica eventos, sin conocer
 * el mecanismo de entrega concreto (Documento 2: "Ningún componente del dominio
 * utilizará directamente el EventEmitter de NestJS"). Los nombres de evento
 * (`MachineConnected`/`MachineDisconnected`/`SignalUpdated`) se modelan como tipos
 * literales, no como claves de objeto, para respetar la convención camelCase del proyecto.
 */
export interface IEventPublisher {
  publish(eventName: 'MachineConnected', payload: MachineConnectedPayload): void;
  publish(eventName: 'MachineDisconnected', payload: MachineDisconnectedPayload): void;
  publish(eventName: 'SignalUpdated', payload: SignalUpdatedPayload): void;
  publish(eventName: 'AlarmTriggered', payload: AlarmTriggeredPayload): void;
  publish(eventName: 'AlarmCleared', payload: AlarmClearedPayload): void;
  publish(eventName: 'AlarmAcked', payload: AlarmAckedPayload): void;
}

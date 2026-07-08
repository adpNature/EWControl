export const EVENT_PUBLISHER = Symbol('EventPublisher');

/**
 * Eventos de dominio relevantes para esta spec (Documento 2, apartado 2.7,
 * "Eventos Principales"). Se amplía a medida que otras specs necesiten publicar
 * eventos nuevos.
 */
export type MachineConnectedPayload = { machineId: string; timestamp: Date };
export type MachineDisconnectedPayload = { machineId: string; timestamp: Date };

/**
 * Único punto por el que el dominio/aplicación publica eventos, sin conocer
 * el mecanismo de entrega concreto (Documento 2: "Ningún componente del dominio
 * utilizará directamente el EventEmitter de NestJS"). Los nombres de evento
 * (`MachineConnected`/`MachineDisconnected`) se modelan como tipos literales,
 * no como claves de objeto, para respetar la convención camelCase del proyecto.
 */
export interface IEventPublisher {
  publish(eventName: 'MachineConnected', payload: MachineConnectedPayload): void;
  publish(eventName: 'MachineDisconnected', payload: MachineDisconnectedPayload): void;
}

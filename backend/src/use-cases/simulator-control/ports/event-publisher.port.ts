import type { AlarmPriority } from '../../../entities/alarm-priority.enum';
import type { ProviderType } from '../../../entities/provider-type.enum';
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
  /**
   * docs/07-observabilidad-monitorizacion.md, apartado 7.6 (spec 15). Único
   * evento que lo transporta: `AlarmTriggered`/`AlarmCleared`/`AlarmAcked` son
   * eventos de dominio nuevos, no una retransmisión de la Variable original.
   */
  correlationId: string;
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
 * docs/specs/18-integracion-opc-ua.md: evento interno (no se reemite por
 * WebSocket) tras reemplazar la `MachineConnection`, para que los registries de
 * Data Providers paren el provider anterior y arranquen el nuevo en caliente.
 * `previousProviderType` es `null` si la Machine no tenía conexión.
 */
export type MachineConnectionReplacedPayload = {
  machineId: string;
  companyId: string;
  previousProviderType: ProviderType | null;
  providerType: ProviderType;
};
/** docs/specs/18-integracion-opc-ua.md: evento interno tras la baja lógica de una Machine. */
export type MachineDeactivatedPayload = { machineId: string; companyId: string };
/**
 * docs/specs/18-integracion-opc-ua.md: evento interno tras crear o editar una
 * Signal. Un Data Provider que solo notifica cambios (OPC UA) republica sus
 * últimos valores para que la Signal nueva no quede sin valor.
 */
export type MachineSignalsChangedPayload = { machineId: string; companyId: string };

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
  publish(eventName: 'MachineConnectionReplaced', payload: MachineConnectionReplacedPayload): void;
  publish(eventName: 'MachineDeactivated', payload: MachineDeactivatedPayload): void;
  publish(eventName: 'MachineSignalsChanged', payload: MachineSignalsChangedPayload): void;
}

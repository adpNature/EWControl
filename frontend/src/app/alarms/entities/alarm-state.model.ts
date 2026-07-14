import { AlarmPriority } from './alarm-definition.model';

/** Documento 3, apartado 3.2.7. */
export type AlarmStateStatus = 'ACTIVE' | 'INACTIVE';

export interface AlarmState {
  id: string;
  alarmDefinitionId: string;
  signalId: string;
  status: AlarmStateStatus;
  priority: AlarmPriority;
  activatedAt: string;
  resolvedAt: string | null;
}

/** `GET /alarm-states/:id`: el AlarmState pedido más el histórico completo de su AlarmDefinition. */
export interface AlarmStateDetail extends AlarmState {
  history: AlarmState[];
}

export interface AlarmStateFilters {
  status?: AlarmStateStatus;
  machineId?: string;
  priority?: AlarmPriority;
}

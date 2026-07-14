/** Documento 3, apartado 3.2.6. */
export type AlarmOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

export type AlarmPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AlarmDefinition {
  id: string;
  signalId: string;
  operator: AlarmOperator;
  threshold: number | boolean | string;
  priority: AlarmPriority;
  notifyByEmail: boolean;
  showOnDashboard: boolean;
  isActive: boolean;
}

export interface CreateAlarmDefinitionRequest {
  operator: AlarmOperator;
  threshold: number | boolean | string;
  priority: AlarmPriority;
  notifyByEmail: boolean;
  showOnDashboard: boolean;
}

export type UpdateAlarmDefinitionRequest = Partial<CreateAlarmDefinitionRequest>;

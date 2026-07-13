import { AlarmDefinition } from '../../../entities/alarm-definition.entity';
import type { AlarmOperator } from '../../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const ALARM_DEFINITION_REPOSITORY = Symbol('AlarmDefinitionRepository');

export interface IAlarmDefinitionRepository {
  create(
    data: {
      signalId: string;
      operator: AlarmOperator;
      threshold: number | boolean | string;
      priority: AlarmPriority;
      notifyByEmail: boolean;
      showOnDashboard: boolean;
    },
    ctx: TransactionContext,
  ): Promise<AlarmDefinition>;
  findById(id: string, ctx: TransactionContext): Promise<AlarmDefinition | null>;
  findAllBySignalId(signalId: string, ctx: TransactionContext): Promise<AlarmDefinition[]>;
  /** Usado por el Alarm Engine: solo reglas activas evalúan (Documento 3, apartado 3.2.6, Regla 3). */
  findActiveBySignalId(signalId: string, ctx: TransactionContext): Promise<AlarmDefinition[]>;
  update(
    id: string,
    changes: Partial<{
      operator: AlarmOperator;
      threshold: number | boolean | string;
      priority: AlarmPriority;
      notifyByEmail: boolean;
      showOnDashboard: boolean;
    }>,
    ctx: TransactionContext,
  ): Promise<AlarmDefinition>;
  deactivate(id: string, ctx: TransactionContext): Promise<AlarmDefinition>;
}

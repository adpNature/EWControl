import { AlarmState } from '../../../entities/alarm-state.entity';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { AlarmStateType } from '../../../entities/alarm-state-type.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const ALARM_STATE_REPOSITORY = Symbol('AlarmStateRepository');

export interface IAlarmStateRepository {
  /** El AlarmState vigente de una AlarmDefinition: el de `activatedAt` más reciente, o `null` si nunca se activó. */
  findCurrentByAlarmDefinitionId(
    alarmDefinitionId: string,
    ctx: TransactionContext,
  ): Promise<AlarmState | null>;
  /** Histórico completo, ordenado por `activatedAt` descendente (el primero es el vigente). */
  findHistoryByAlarmDefinitionId(
    alarmDefinitionId: string,
    ctx: TransactionContext,
  ): Promise<AlarmState[]>;
  findById(id: string, ctx: TransactionContext): Promise<AlarmState | null>;
  createActivation(
    data: {
      alarmDefinitionId: string;
      signalId: string;
      priority: AlarmPriority;
      activatedAt: Date;
    },
    ctx: TransactionContext,
  ): Promise<AlarmState>;
  resolveActivation(
    alarmStateId: string,
    resolvedAt: Date,
    ctx: TransactionContext,
  ): Promise<AlarmState>;
  /** Reconocimiento manual (ACK, docs/specs/11-ack-alarmas.md). No altera `status`/`activatedAt`/`resolvedAt`. */
  acknowledge(
    alarmStateId: string,
    data: { ackedAt: Date; ackedByUserId: string; ackedByEmail: string },
    ctx: TransactionContext,
  ): Promise<AlarmState>;
  list(
    filter: {
      companyId: string | null;
      status?: AlarmStateType;
      machineId?: string;
      priority?: AlarmPriority;
    },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: AlarmState[]; total: number }>;
}

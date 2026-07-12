import { Signal } from '../../../entities/signal.entity';
import { SignalSource } from '../../../entities/signal-source.vo';
import { SignalType } from '../../../entities/signal-type.enum';
import { TransactionContext } from './transaction-context';

export const SIGNAL_REPOSITORY = Symbol('SignalRepository');

export interface ISignalRepository {
  create(
    data: {
      machineId: string;
      name: string;
      signalType: SignalType;
      signalSource: SignalSource;
      unit: string;
      historyEnabled: boolean;
    },
    ctx: TransactionContext,
  ): Promise<Signal>;
  findById(id: string, ctx: TransactionContext): Promise<Signal | null>;
  findAllByMachineId(machineId: string, ctx: TransactionContext): Promise<Signal[]>;
  /** Usado por el Signal Engine (docs/specs/07-dashboard-tiempo-real.md) para resolver a qué Signal DIRECT corresponde un tick. */
  findActiveDirectByMachineAndVariableName(
    machineId: string,
    variableName: string,
    ctx: TransactionContext,
  ): Promise<Signal | null>;
  list(
    filter: { machineId: string; isActive: boolean },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Signal[]; total: number }>;
  update(
    id: string,
    changes: Partial<{ name: string; signalSource: SignalSource; unit: string }>,
    ctx: TransactionContext,
  ): Promise<Signal>;
  softDeactivate(id: string, ctx: TransactionContext): Promise<Signal>;
  deactivateAllByMachineId(machineId: string, ctx: TransactionContext): Promise<void>;
}

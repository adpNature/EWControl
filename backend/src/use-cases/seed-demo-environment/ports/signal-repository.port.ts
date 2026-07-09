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
}

import { Machine } from '../../../entities/machine.entity';
import { TransactionContext } from './transaction-context';

export const MACHINE_REPOSITORY = Symbol('MachineRepository');

export interface IMachineRepository {
  create(data: { companyId: string; name: string }, ctx: TransactionContext): Promise<Machine>;
}

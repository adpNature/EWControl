import { Machine } from '../../../entities/machine.entity';
import { TransactionContext } from './transaction-context';

export const MACHINE_REPOSITORY = Symbol('MachineRepository');

export interface IMachineRepository {
  create(data: { companyId: string; name: string }, ctx: TransactionContext): Promise<Machine>;
  findById(id: string, ctx: TransactionContext): Promise<Machine | null>;
  list(
    filter: { companyId: string | null; isActive: boolean },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Machine[]; total: number }>;
  update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Machine>;
  softDeactivate(id: string, ctx: TransactionContext): Promise<Machine>;
  /** Borrado físico (docs/specs/10-gestion-companies-users.md, "purge" de Company): sin paginar, activas e inactivas. */
  findAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<Machine[]>;
  deleteAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<void>;
}

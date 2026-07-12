import { Dashboard } from '../../../entities/dashboard.entity';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const DASHBOARD_REPOSITORY = Symbol('DashboardRepository');

export interface IDashboardRepository {
  create(data: { companyId: string; name: string }, ctx: TransactionContext): Promise<Dashboard>;
  findById(id: string, ctx: TransactionContext): Promise<Dashboard | null>;
  list(
    filter: { companyId: string | null },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Dashboard[]; total: number }>;
  update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Dashboard>;
  delete(id: string, ctx: TransactionContext): Promise<void>;
}

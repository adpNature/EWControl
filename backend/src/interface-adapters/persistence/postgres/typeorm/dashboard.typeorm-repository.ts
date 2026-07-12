import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Dashboard } from '../../../../entities/dashboard.entity';
import { IDashboardRepository } from '../../../../use-cases/dashboard/ports/dashboard-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class DashboardTypeOrmRepository implements IDashboardRepository {
  create(data: { companyId: string; name: string }, ctx: TransactionContext): Promise<Dashboard> {
    const repository = (ctx as EntityManager).getRepository(Dashboard);
    return repository.save(repository.create(data));
  }

  findById(id: string, ctx: TransactionContext): Promise<Dashboard | null> {
    return (ctx as EntityManager).getRepository(Dashboard).findOne({ where: { id } });
  }

  async list(
    filter: { companyId: string | null },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Dashboard[]; total: number }> {
    const repository = (ctx as EntityManager).getRepository(Dashboard);
    const where = filter.companyId ? { companyId: filter.companyId } : {};
    const [data, total] = await repository.findAndCount({
      where,
      take: pagination.limit,
      skip: pagination.offset,
      order: { name: 'ASC' },
    });
    return { data, total };
  }

  async update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Dashboard> {
    const repository = (ctx as EntityManager).getRepository(Dashboard);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async delete(id: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(Dashboard).delete(id);
  }
}

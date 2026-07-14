import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Machine } from '../../../../entities/machine.entity';
import { IMachineRepository } from '../../../../use-cases/seed-demo-environment/ports/machine-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class MachineTypeOrmRepository implements IMachineRepository {
  create(data: { companyId: string; name: string }, ctx: TransactionContext): Promise<Machine> {
    const repository = (ctx as EntityManager).getRepository(Machine);
    return repository.save(repository.create(data));
  }

  findById(id: string, ctx: TransactionContext): Promise<Machine | null> {
    return (ctx as EntityManager).getRepository(Machine).findOne({ where: { id } });
  }

  async list(
    filter: { companyId: string | null; isActive: boolean },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Machine[]; total: number }> {
    const repository = (ctx as EntityManager).getRepository(Machine);
    const where = filter.companyId
      ? { companyId: filter.companyId, isActive: filter.isActive }
      : { isActive: filter.isActive };
    const [data, total] = await repository.findAndCount({
      where,
      take: pagination.limit,
      skip: pagination.offset,
      order: { name: 'ASC' },
    });
    return { data, total };
  }

  async update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Machine> {
    const repository = (ctx as EntityManager).getRepository(Machine);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async softDeactivate(id: string, ctx: TransactionContext): Promise<Machine> {
    const repository = (ctx as EntityManager).getRepository(Machine);
    await repository.update(id, { isActive: false });
    return repository.findOneByOrFail({ id });
  }

  findAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<Machine[]> {
    return (ctx as EntityManager).getRepository(Machine).find({ where: { companyId } });
  }

  async deleteAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(Machine).delete({ companyId });
  }
}

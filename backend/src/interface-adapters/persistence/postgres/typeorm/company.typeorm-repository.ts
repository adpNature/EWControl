import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Company } from '../../../../entities/company.entity';
import { ICompanyRepository } from '../../../../use-cases/seed-demo-environment/ports/company-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class CompanyTypeOrmRepository implements ICompanyRepository {
  findByName(name: string, ctx: TransactionContext): Promise<Company | null> {
    return (ctx as EntityManager).getRepository(Company).findOne({ where: { name } });
  }

  findById(id: string, ctx: TransactionContext): Promise<Company | null> {
    return (ctx as EntityManager).getRepository(Company).findOne({ where: { id } });
  }

  create(data: { name: string }, ctx: TransactionContext): Promise<Company> {
    const repository = (ctx as EntityManager).getRepository(Company);
    return repository.save(repository.create(data));
  }

  async list(
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Company[]; total: number }> {
    const repository = (ctx as EntityManager).getRepository(Company);
    const [data, total] = await repository.findAndCount({
      take: pagination.limit,
      skip: pagination.offset,
      order: { name: 'ASC' },
    });
    return { data, total };
  }

  async update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Company> {
    const repository = (ctx as EntityManager).getRepository(Company);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async deactivate(id: string, ctx: TransactionContext): Promise<Company> {
    const repository = (ctx as EntityManager).getRepository(Company);
    await repository.update(id, { isActive: false });
    return repository.findOneByOrFail({ id });
  }

  async reactivate(id: string, ctx: TransactionContext): Promise<Company> {
    const repository = (ctx as EntityManager).getRepository(Company);
    await repository.update(id, { isActive: true });
    return repository.findOneByOrFail({ id });
  }

  async delete(id: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(Company).delete(id);
  }
}

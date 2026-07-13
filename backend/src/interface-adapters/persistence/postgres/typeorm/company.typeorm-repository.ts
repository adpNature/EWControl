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
}

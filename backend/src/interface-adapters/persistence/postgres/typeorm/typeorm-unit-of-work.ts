import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { IUnitOfWork } from '../../../../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class TypeOrmUnitOfWork implements IUnitOfWork {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  runInTransaction<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager: EntityManager) => work(manager));
  }
}

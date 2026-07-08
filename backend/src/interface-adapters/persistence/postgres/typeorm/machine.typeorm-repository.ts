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
}

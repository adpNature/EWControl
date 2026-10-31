import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { WritePackage } from '../../../../entities/write-package.entity';
import type {
  IWritePackageRepository,
  WritePackageData,
} from '../../../../use-cases/write-packages/ports/write-package-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class WritePackageTypeOrmRepository implements IWritePackageRepository {
  create(
    data: WritePackageData & { machineId: string },
    ctx: TransactionContext,
  ): Promise<WritePackage> {
    const repository = (ctx as EntityManager).getRepository(WritePackage);
    return repository.save(repository.create(data));
  }

  findById(id: string, ctx: TransactionContext): Promise<WritePackage | null> {
    return (ctx as EntityManager).getRepository(WritePackage).findOne({ where: { id } });
  }

  findActiveByMachineAndName(
    machineId: string,
    name: string,
    ctx: TransactionContext,
  ): Promise<WritePackage | null> {
    return (ctx as EntityManager)
      .getRepository(WritePackage)
      .findOne({ where: { machineId, name, isActive: true } });
  }

  listActiveByMachine(machineId: string, ctx: TransactionContext): Promise<WritePackage[]> {
    return (ctx as EntityManager)
      .getRepository(WritePackage)
      .find({ where: { machineId, isActive: true }, order: { name: 'ASC' } });
  }

  async update(
    id: string,
    changes: Partial<WritePackageData>,
    ctx: TransactionContext,
  ): Promise<WritePackage> {
    const repository = (ctx as EntityManager).getRepository(WritePackage);
    await repository.update({ id }, { ...changes, updatedAt: new Date() });
    return repository.findOneByOrFail({ id });
  }

  async deactivate(id: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager)
      .getRepository(WritePackage)
      .update({ id }, { isActive: false, updatedAt: new Date() });
  }
}

import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { WritePackageExecution } from '../../../../entities/write-package-execution.entity';
import type { IWritePackageExecutionRepository } from '../../../../use-cases/write-packages/ports/write-package-execution-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

/** Solo alta y lectura: la auditoría de ejecuciones es inmutable (docs/specs/20-paquetes-escritura-opc-ua.md). */
@Injectable()
export class WritePackageExecutionTypeOrmRepository implements IWritePackageExecutionRepository {
  create(
    data: Omit<WritePackageExecution, 'id'>,
    ctx: TransactionContext,
  ): Promise<WritePackageExecution> {
    const repository = (ctx as EntityManager).getRepository(WritePackageExecution);
    return repository.save(repository.create(data));
  }

  async listByPackage(
    packageId: string,
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: WritePackageExecution[]; total: number }> {
    const [data, total] = await (ctx as EntityManager)
      .getRepository(WritePackageExecution)
      .findAndCount({
        where: { packageId },
        order: { executedAt: 'DESC' },
        take: pagination.limit,
        skip: pagination.offset,
      });
    return { data, total };
  }
}

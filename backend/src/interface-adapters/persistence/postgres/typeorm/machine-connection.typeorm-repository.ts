import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ConnectionConfig } from '../../../../entities/connection-config.vo';
import { MachineConnection } from '../../../../entities/machine-connection.entity';
import { ProviderType } from '../../../../entities/provider-type.enum';
import { IMachineConnectionRepository } from '../../../../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class MachineConnectionTypeOrmRepository implements IMachineConnectionRepository {
  create(
    data: { machineId: string; providerType: ProviderType; connectionConfig: ConnectionConfig },
    ctx: TransactionContext,
  ): Promise<MachineConnection> {
    const repository = (ctx as EntityManager).getRepository(MachineConnection);
    return repository.save(repository.create(data));
  }

  findByMachineId(machineId: string, ctx: TransactionContext): Promise<MachineConnection | null> {
    return (ctx as EntityManager)
      .getRepository(MachineConnection)
      .findOne({ where: { machineId } });
  }

  async findByMachineIds(
    machineIds: string[],
    ctx: TransactionContext,
  ): Promise<MachineConnection[]> {
    if (machineIds.length === 0) {
      return [];
    }
    return (ctx as EntityManager)
      .getRepository(MachineConnection)
      .find({ where: { machineId: In(machineIds) } });
  }

  findAllByProviderType(
    providerType: ProviderType,
    ctx: TransactionContext,
  ): Promise<MachineConnection[]> {
    return (ctx as EntityManager)
      .getRepository(MachineConnection)
      .find({ where: { providerType } });
  }

  async replace(
    machineId: string,
    changes: { providerType: ProviderType; connectionConfig: ConnectionConfig },
    ctx: TransactionContext,
  ): Promise<MachineConnection> {
    const repository = (ctx as EntityManager).getRepository(MachineConnection);
    await repository.update({ machineId }, changes);
    return repository.findOneByOrFail({ machineId });
  }

  async deleteByMachineId(machineId: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(MachineConnection).delete({ machineId });
  }
}

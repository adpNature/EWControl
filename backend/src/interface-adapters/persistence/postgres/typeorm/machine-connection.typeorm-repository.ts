import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
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

  findAllByProviderType(
    providerType: ProviderType,
    ctx: TransactionContext,
  ): Promise<MachineConnection[]> {
    return (ctx as EntityManager)
      .getRepository(MachineConnection)
      .find({ where: { providerType } });
  }
}

import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Signal } from '../../../../entities/signal.entity';
import { SignalSource } from '../../../../entities/signal-source.vo';
import { SignalType } from '../../../../entities/signal-type.enum';
import { ISignalRepository } from '../../../../use-cases/seed-demo-environment/ports/signal-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class SignalTypeOrmRepository implements ISignalRepository {
  create(
    data: {
      machineId: string;
      name: string;
      signalType: SignalType;
      signalSource: SignalSource;
      unit: string;
      historyEnabled: boolean;
    },
    ctx: TransactionContext,
  ): Promise<Signal> {
    const repository = (ctx as EntityManager).getRepository(Signal);
    return repository.save(repository.create(data));
  }

  findById(id: string, ctx: TransactionContext): Promise<Signal | null> {
    return (ctx as EntityManager).getRepository(Signal).findOne({ where: { id } });
  }

  findAllByMachineId(machineId: string, ctx: TransactionContext): Promise<Signal[]> {
    return (ctx as EntityManager).getRepository(Signal).find({ where: { machineId } });
  }

  async list(
    filter: { machineId: string; isActive: boolean },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Signal[]; total: number }> {
    const repository = (ctx as EntityManager).getRepository(Signal);
    const [data, total] = await repository.findAndCount({
      where: { machineId: filter.machineId, isActive: filter.isActive },
      take: pagination.limit,
      skip: pagination.offset,
      order: { name: 'ASC' },
    });
    return { data, total };
  }

  async update(
    id: string,
    changes: Partial<{ name: string; signalSource: SignalSource; unit: string }>,
    ctx: TransactionContext,
  ): Promise<Signal> {
    const repository = (ctx as EntityManager).getRepository(Signal);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async softDeactivate(id: string, ctx: TransactionContext): Promise<Signal> {
    const repository = (ctx as EntityManager).getRepository(Signal);
    await repository.update(id, { isActive: false });
    return repository.findOneByOrFail({ id });
  }

  async deactivateAllByMachineId(machineId: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(Signal).update({ machineId }, { isActive: false });
  }
}

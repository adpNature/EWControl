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
}

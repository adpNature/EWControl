import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AlarmDefinition } from '../../../../entities/alarm-definition.entity';
import type { AlarmOperator } from '../../../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../../../entities/alarm-priority.enum';
import { IAlarmDefinitionRepository } from '../../../../use-cases/alarms/ports/alarm-definition-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class AlarmDefinitionTypeOrmRepository implements IAlarmDefinitionRepository {
  create(
    data: {
      signalId: string;
      operator: AlarmOperator;
      threshold: number | boolean | string;
      priority: AlarmPriority;
      notifyByEmail: boolean;
      showOnDashboard: boolean;
    },
    ctx: TransactionContext,
  ): Promise<AlarmDefinition> {
    const repository = (ctx as EntityManager).getRepository(AlarmDefinition);
    return repository.save(repository.create({ ...data, isActive: true }));
  }

  findById(id: string, ctx: TransactionContext): Promise<AlarmDefinition | null> {
    return (ctx as EntityManager).getRepository(AlarmDefinition).findOne({ where: { id } });
  }

  findAllBySignalId(signalId: string, ctx: TransactionContext): Promise<AlarmDefinition[]> {
    return (ctx as EntityManager).getRepository(AlarmDefinition).find({ where: { signalId } });
  }

  findActiveBySignalId(signalId: string, ctx: TransactionContext): Promise<AlarmDefinition[]> {
    return (ctx as EntityManager)
      .getRepository(AlarmDefinition)
      .find({ where: { signalId, isActive: true } });
  }

  async update(
    id: string,
    changes: Partial<{
      operator: AlarmOperator;
      threshold: number | boolean | string;
      priority: AlarmPriority;
      notifyByEmail: boolean;
      showOnDashboard: boolean;
    }>,
    ctx: TransactionContext,
  ): Promise<AlarmDefinition> {
    const repository = (ctx as EntityManager).getRepository(AlarmDefinition);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async deactivate(id: string, ctx: TransactionContext): Promise<AlarmDefinition> {
    const repository = (ctx as EntityManager).getRepository(AlarmDefinition);
    await repository.update(id, { isActive: false });
    return repository.findOneByOrFail({ id });
  }
}

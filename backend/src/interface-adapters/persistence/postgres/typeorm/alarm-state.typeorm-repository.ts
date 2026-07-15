import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AlarmState } from '../../../../entities/alarm-state.entity';
import { AlarmPriority } from '../../../../entities/alarm-priority.enum';
import { AlarmStateType } from '../../../../entities/alarm-state-type.enum';
import { Machine } from '../../../../entities/machine.entity';
import { Signal } from '../../../../entities/signal.entity';
import { IAlarmStateRepository } from '../../../../use-cases/alarms/ports/alarm-state-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class AlarmStateTypeOrmRepository implements IAlarmStateRepository {
  findCurrentByAlarmDefinitionId(
    alarmDefinitionId: string,
    ctx: TransactionContext,
  ): Promise<AlarmState | null> {
    return (ctx as EntityManager)
      .getRepository(AlarmState)
      .findOne({ where: { alarmDefinitionId }, order: { activatedAt: 'DESC' } });
  }

  findHistoryByAlarmDefinitionId(
    alarmDefinitionId: string,
    ctx: TransactionContext,
  ): Promise<AlarmState[]> {
    return (ctx as EntityManager)
      .getRepository(AlarmState)
      .find({ where: { alarmDefinitionId }, order: { activatedAt: 'DESC' } });
  }

  findById(id: string, ctx: TransactionContext): Promise<AlarmState | null> {
    return (ctx as EntityManager).getRepository(AlarmState).findOne({ where: { id } });
  }

  createActivation(
    data: {
      alarmDefinitionId: string;
      signalId: string;
      priority: AlarmPriority;
      activatedAt: Date;
    },
    ctx: TransactionContext,
  ): Promise<AlarmState> {
    const repository = (ctx as EntityManager).getRepository(AlarmState);
    return repository.save(
      repository.create({ ...data, status: AlarmStateType.Active, resolvedAt: null }),
    );
  }

  async resolveActivation(
    alarmStateId: string,
    resolvedAt: Date,
    ctx: TransactionContext,
  ): Promise<AlarmState> {
    const repository = (ctx as EntityManager).getRepository(AlarmState);
    await repository.update(alarmStateId, { status: AlarmStateType.Inactive, resolvedAt });
    return repository.findOneByOrFail({ id: alarmStateId });
  }

  async acknowledge(
    alarmStateId: string,
    data: { ackedAt: Date; ackedByUserId: string; ackedByEmail: string },
    ctx: TransactionContext,
  ): Promise<AlarmState> {
    const repository = (ctx as EntityManager).getRepository(AlarmState);
    await repository.update(alarmStateId, {
      ackedAt: data.ackedAt,
      ackedByUserId: data.ackedByUserId,
      ackedByEmail: data.ackedByEmail,
    });
    return repository.findOneByOrFail({ id: alarmStateId });
  }

  async list(
    filter: {
      companyId: string | null;
      status?: AlarmStateType;
      machineId?: string;
      priority?: AlarmPriority;
    },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: AlarmState[]; total: number }> {
    const query = (ctx as EntityManager)
      .getRepository(AlarmState)
      .createQueryBuilder('alarm_state')
      .innerJoin(Signal, 'signal', 'signal.id = alarm_state.signal_id')
      .innerJoin(Machine, 'machine', 'machine.id = signal.machine_id');

    if (filter.companyId !== null) {
      query.andWhere('machine.company_id = :companyId', { companyId: filter.companyId });
    }
    if (filter.status) {
      query.andWhere('alarm_state.status = :status', { status: filter.status });
    }
    if (filter.machineId) {
      query.andWhere('machine.id = :machineId', { machineId: filter.machineId });
    }
    if (filter.priority) {
      query.andWhere('alarm_state.priority = :priority', { priority: filter.priority });
    }

    const [data, total] = await query
      .orderBy('alarm_state.activatedAt', 'DESC')
      .take(pagination.limit)
      .skip(pagination.offset)
      .getManyAndCount();

    return { data, total };
  }
}

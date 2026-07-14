import { Inject, Injectable } from '@nestjs/common';
import { AlarmState } from '../../entities/alarm-state.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { AlarmStateNotFoundError } from './errors/alarm-state-not-found.error';
import {
  ALARM_STATE_REPOSITORY,
  type IAlarmStateRepository,
} from './ports/alarm-state-repository.port';

export type Requester = { companyId: string; role: UserRole };

/**
 * Aislamiento multiempresa de un AlarmState (`GET /alarm-states/:id`): resuelve
 * la cadena AlarmState → Signal (vía `signalId` denormalizado) → Machine para
 * verificar la Company, mismo criterio 404-nunca-403 que el resto de resolvers
 * (docs/06-seguridad-global.md, 6.7).
 */
@Injectable()
export class AlarmStateAccessResolver {
  constructor(
    @Inject(ALARM_STATE_REPOSITORY) private readonly alarmStateRepository: IAlarmStateRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
  ) {}

  async resolveAny(
    alarmStateId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<AlarmState> {
    const alarmState = await this.alarmStateRepository.findById(alarmStateId, ctx);
    if (!alarmState) {
      throw new AlarmStateNotFoundError(alarmStateId);
    }
    const signal = await this.signalRepository.findById(alarmState.signalId, ctx);
    if (!signal) {
      throw new AlarmStateNotFoundError(alarmStateId);
    }
    const machine = await this.machineRepository.findById(signal.machineId, ctx);
    if (!machine || !this.belongsToRequester(machine, requester)) {
      throw new AlarmStateNotFoundError(alarmStateId);
    }
    return alarmState;
  }

  private belongsToRequester(machine: { companyId: string }, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || machine.companyId === requester.companyId;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { AlarmDefinition } from '../../entities/alarm-definition.entity';
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
import { AlarmDefinitionNotFoundError } from './errors/alarm-definition-not-found.error';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';

export type Requester = { companyId: string; role: UserRole };

/**
 * Aislamiento multiempresa de una AlarmDefinition referenciada por `:id`
 * (`PATCH`/`DELETE /alarm-definitions/:id`, docs/11-api-rest.md): resuelve la
 * cadena AlarmDefinition → Signal → Machine para verificar la Company, mismo
 * criterio 404-nunca-403 que el resto de resolvers (docs/06-seguridad-global.md, 6.7).
 */
@Injectable()
export class AlarmDefinitionAccessResolver {
  constructor(
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
  ) {}

  async resolveAny(
    alarmDefinitionId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<AlarmDefinition> {
    const definition = await this.alarmDefinitionRepository.findById(alarmDefinitionId, ctx);
    if (!definition) {
      throw new AlarmDefinitionNotFoundError(alarmDefinitionId);
    }
    const signal = await this.signalRepository.findById(definition.signalId, ctx);
    if (!signal) {
      throw new AlarmDefinitionNotFoundError(alarmDefinitionId);
    }
    const machine = await this.machineRepository.findById(signal.machineId, ctx);
    if (!machine || !this.belongsToRequester(machine, requester)) {
      throw new AlarmDefinitionNotFoundError(alarmDefinitionId);
    }
    return definition;
  }

  private belongsToRequester(machine: { companyId: string }, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || machine.companyId === requester.companyId;
  }
}

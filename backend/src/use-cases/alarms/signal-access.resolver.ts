import { Inject, Injectable } from '@nestjs/common';
import { Signal } from '../../entities/signal.entity';
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
import { SignalNotFoundError } from './errors/signal-not-found.error';

export type Requester = { companyId: string; role: UserRole };

/**
 * Aislamiento multiempresa de una Signal referenciada directamente por `signalId`
 * (sin `:machineId` en la ruta, a diferencia de `MachineAccessResolver` — las
 * rutas de AlarmDefinition cuelgan de `/signals/:signalId/...`, docs/11-api-rest.md).
 * Inexistente, inactiva, o de otra Company responde siempre 404, nunca 403
 * (docs/06-seguridad-global.md, 6.7).
 */
@Injectable()
export class SignalAccessResolver {
  constructor(
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
  ) {}

  async resolveActive(
    signalId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<Signal> {
    const signal = await this.signalRepository.findById(signalId, ctx);
    if (!signal || !signal.isActive) {
      throw new SignalNotFoundError(signalId);
    }
    const machine = await this.machineRepository.findById(signal.machineId, ctx);
    if (!machine || !machine.isActive || !this.belongsToRequester(machine, requester)) {
      throw new SignalNotFoundError(signalId);
    }
    return signal;
  }

  private belongsToRequester(machine: { companyId: string }, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || machine.companyId === requester.companyId;
  }
}

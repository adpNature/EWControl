import { Inject, Injectable } from '@nestjs/common';
import { Signal } from '../../entities/signal.entity';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type GetSignalInput = { machineId: string; signalId: string; requester: Requester };

@Injectable()
export class GetSignalUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetSignalInput): Promise<Signal> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      const signal = await this.signalRepository.findById(input.signalId, ctx);
      if (!signal || signal.machineId !== machine.id || !signal.isActive) {
        throw new SignalNotFoundError(input.signalId, machine.id);
      }
      return signal;
    });
  }
}

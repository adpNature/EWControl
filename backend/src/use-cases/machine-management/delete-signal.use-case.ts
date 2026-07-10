import { Inject, Injectable } from '@nestjs/common';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type DeleteSignalInput = { machineId: string; signalId: string; requester: Requester };

@Injectable()
export class DeleteSignalUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeleteSignalInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);

      const signal = await this.signalRepository.findById(input.signalId, ctx);
      if (!signal || signal.machineId !== machine.id) {
        throw new SignalNotFoundError(input.signalId, machine.id);
      }
      await this.signalRepository.softDeactivate(signal.id, ctx);
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { Signal } from '../../entities/signal.entity';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type ListSignalsInput = {
  machineId: string;
  requester: Requester;
  pagination: { limit: number; offset: number };
};
export type ListSignalsResult = { data: Signal[]; total: number; limit: number; offset: number };

@Injectable()
export class ListSignalsUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: ListSignalsInput): Promise<ListSignalsResult> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      const { data, total } = await this.signalRepository.list(
        { machineId: machine.id, isActive: true },
        input.pagination,
        ctx,
      );
      return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
    });
  }
}

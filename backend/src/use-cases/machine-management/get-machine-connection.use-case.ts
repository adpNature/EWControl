import { Inject, Injectable } from '@nestjs/common';
import { MachineConnection } from '../../entities/machine-connection.entity';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type GetMachineConnectionInput = { machineId: string; requester: Requester };

@Injectable()
export class GetMachineConnectionUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetMachineConnectionInput): Promise<MachineConnection | null> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      return this.machineConnectionRepository.findByMachineId(machine.id, ctx);
    });
  }
}

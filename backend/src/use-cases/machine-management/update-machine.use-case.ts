import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type UpdateMachineInput = { machineId: string; requester: Requester; name: string };

/** docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 6 y 8. */
@Injectable()
export class UpdateMachineUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateMachineInput): Promise<Machine> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);
      return this.machineRepository.update(machine.id, { name: input.name }, ctx);
    });
  }
}

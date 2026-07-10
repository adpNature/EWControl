import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type GetMachineInput = { machineId: string; requester: Requester };

/** docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 2 y 6. */
@Injectable()
export class GetMachineUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetMachineInput): Promise<Machine> {
    return this.unitOfWork.runInTransaction((ctx) =>
      this.resolver.resolveActive(input.machineId, input.requester, ctx),
    );
  }
}

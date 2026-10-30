import { Inject, Injectable } from '@nestjs/common';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import type { MachineWithProvider } from './list-machines.use-case';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type GetMachineInput = { machineId: string; requester: Requester };

/**
 * docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 2 y 6;
 * incluye `providerType` (docs/specs/18-integracion-opc-ua.md, criterio backend 12).
 */
@Injectable()
export class GetMachineUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetMachineInput): Promise<MachineWithProvider> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      const connection = await this.machineConnectionRepository.findByMachineId(machine.id, ctx);
      return { ...machine, providerType: connection?.providerType ?? null };
    });
  }
}

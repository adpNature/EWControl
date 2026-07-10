import { Inject, Injectable } from '@nestjs/common';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type DeleteMachineInput = { machineId: string; requester: Requester };

/**
 * docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 3 y 8:
 * baja lógica de la Machine con desactivación en cascada de todas sus Signals,
 * sin borrar filas ni histórico. Una Machine ya inactiva responde 422 (idempotencia
 * explícita: "volver a darla de baja" también es un caso de MachineInactiveError).
 */
@Injectable()
export class DeleteMachineUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeleteMachineInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);
      await this.machineRepository.softDeactivate(machine.id, ctx);
      await this.signalRepository.deactivateAllByMachineId(machine.id, ctx);
    });
  }
}

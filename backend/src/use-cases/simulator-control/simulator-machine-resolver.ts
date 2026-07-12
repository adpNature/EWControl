import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import { MachineConnection } from '../../entities/machine-connection.entity';
import { ProviderType } from '../../entities/provider-type.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineNotFoundError } from './errors/machine-not-found.error';
import { NotASimulatedMachineError } from './errors/not-a-simulated-machine.error';

/**
 * Precondición común a los 3 casos de uso de `simulator-control` (spec 03,
 * criterio de aceptación 4): resuelve una Machine y valida que está en modo
 * `Simulator` antes de permitir cualquier operación de control.
 */
@Injectable()
export class SimulatorMachineResolver {
  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  resolve(machineId: string): Promise<{ machine: Machine; connection: MachineConnection }> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.machineRepository.findById(machineId, ctx);
      if (!machine) {
        throw new MachineNotFoundError(machineId);
      }

      const connection = await this.machineConnectionRepository.findByMachineId(machineId, ctx);
      if (!connection || connection.providerType !== ProviderType.Simulator) {
        throw new NotASimulatedMachineError(machineId);
      }

      return { machine, connection };
    });
  }
}

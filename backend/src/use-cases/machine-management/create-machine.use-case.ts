import { Inject, Injectable } from '@nestjs/common';
import { ConnectionConfig } from '../../entities/connection-config.vo';
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

export type CreateMachineInput = { companyId: string; name: string };
export type CreateMachineResult = { machine: Machine; connection: MachineConnection };

const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = { seedProfile: 'empty', signals: [] };

/**
 * docs/specs/06-gestion-machines-signals.md, criterio de aceptación backend 1:
 * toda Machine nace con una MachineConnection Simulator por defecto, ambas
 * creadas atómicamente (si la segunda falla, la primera tampoco persiste).
 */
@Injectable()
export class CreateMachineUseCase {
  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateMachineInput): Promise<CreateMachineResult> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.machineRepository.create(
        { companyId: input.companyId, name: input.name },
        ctx,
      );
      const connection = await this.machineConnectionRepository.create(
        {
          machineId: machine.id,
          providerType: ProviderType.Simulator,
          connectionConfig: DEFAULT_CONNECTION_CONFIG,
        },
        ctx,
      );
      return { machine, connection };
    });
  }
}

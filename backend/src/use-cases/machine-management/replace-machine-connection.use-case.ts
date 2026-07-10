import { Inject, Injectable } from '@nestjs/common';
import { ConnectionConfig } from '../../entities/connection-config.vo';
import { MachineConnection } from '../../entities/machine-connection.entity';
import { ProviderType } from '../../entities/provider-type.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { ProviderNotSupportedError } from './errors/provider-not-supported.error';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type ReplaceMachineConnectionInput = {
  machineId: string;
  requester: Requester;
  providerType: ProviderType;
  connectionConfig: ConnectionConfig;
};

/**
 * docs/specs/06-gestion-machines-signals.md, criterio de aceptación backend 4:
 * el único ProviderType soportado hoy es Simulator — el OpcUaProvider es una
 * spec futura (Fase 6 del roadmap), así que cualquier otro valor es 422.
 */
@Injectable()
export class ReplaceMachineConnectionUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ReplaceMachineConnectionInput): Promise<MachineConnection> {
    if (input.providerType !== ProviderType.Simulator) {
      throw new ProviderNotSupportedError(input.providerType);
    }
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);
      return this.machineConnectionRepository.replace(
        machine.id,
        { providerType: input.providerType, connectionConfig: input.connectionConfig },
        ctx,
      );
    });
  }
}

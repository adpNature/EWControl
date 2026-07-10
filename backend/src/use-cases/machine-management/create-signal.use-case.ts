import { Inject, Injectable } from '@nestjs/common';
import { listSeedVariableNames } from '../../entities/connection-config.vo';
import { Signal } from '../../entities/signal.entity';
import {
  findUnknownVariables,
  isFormulaSignalSource,
  SignalSource,
} from '../../entities/signal-source.vo';
import { SignalType } from '../../entities/signal-type.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { FormulaReferencesUnknownVariableError } from './errors/formula-references-unknown-variable.error';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type CreateSignalInput = {
  machineId: string;
  requester: Requester;
  name: string;
  signalType: SignalType;
  signalSource: SignalSource;
  unit: string;
};

/**
 * docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 5 y 8:
 * una Signal FORMULA solo puede referenciar variables ya declaradas en la
 * MachineConnection de la misma Machine (Documento 3, apartado 3.2.5).
 */
@Injectable()
export class CreateSignalUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateSignalInput): Promise<Signal> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);

      if (isFormulaSignalSource(input.signalSource)) {
        const connection = await this.machineConnectionRepository.findByMachineId(machine.id, ctx);
        const knownVariables = connection ? listSeedVariableNames(connection.connectionConfig) : [];
        const unknown = findUnknownVariables(input.signalSource, knownVariables);
        if (unknown.length > 0) {
          throw new FormulaReferencesUnknownVariableError(unknown);
        }
      }

      return this.signalRepository.create(
        {
          machineId: machine.id,
          name: input.name,
          signalType: input.signalType,
          signalSource: input.signalSource,
          unit: input.unit,
          historyEnabled: false,
        },
        ctx,
      );
    });
  }
}

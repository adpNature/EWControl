import { Inject, Injectable } from '@nestjs/common';
import { listSeedVariableNames } from '../../entities/connection-config.vo';
import { validateFormulaExpression } from '../../entities/formula-evaluator';
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
import { FormulaExpressionInvalidError } from './errors/formula-expression-invalid.error';
import { FormulaReferencesUnknownVariableError } from './errors/formula-references-unknown-variable.error';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';

export type UpdateSignalInput = {
  machineId: string;
  signalId: string;
  requester: Requester;
  changes: Partial<{ name: string; signalSource: SignalSource; unit: string }>;
};

/**
 * docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 5 y 8.
 * `signalType` es inmutable tras la creación (no forma parte de `changes`); la
 * revalidación de FORMULA se hace contra el `signalType` ya persistido, que es
 * la única fuente de verdad fiable (el PATCH no lo reenvía).
 */
@Injectable()
export class UpdateSignalUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateSignalInput): Promise<Signal> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);

      const signal = await this.signalRepository.findById(input.signalId, ctx);
      if (!signal || signal.machineId !== machine.id) {
        throw new SignalNotFoundError(input.signalId, machine.id);
      }

      if (
        input.changes.signalSource &&
        signal.signalType === SignalType.FORMULA &&
        isFormulaSignalSource(input.changes.signalSource)
      ) {
        const connection = await this.machineConnectionRepository.findByMachineId(machine.id, ctx);
        const knownVariables = connection ? listSeedVariableNames(connection.connectionConfig) : [];
        const unknown = findUnknownVariables(input.changes.signalSource, knownVariables);
        if (unknown.length > 0) {
          throw new FormulaReferencesUnknownVariableError(unknown);
        }

        const validation = validateFormulaExpression(
          input.changes.signalSource.expression,
          input.changes.signalSource.variables,
        );
        if (!validation.valid) {
          throw new FormulaExpressionInvalidError(validation.reason);
        }
      }

      return this.signalRepository.update(signal.id, input.changes, ctx);
    });
  }
}

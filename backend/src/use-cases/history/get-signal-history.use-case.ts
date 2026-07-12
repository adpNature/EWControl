import { Inject, Injectable } from '@nestjs/common';
import { MachineAccessResolver, Requester } from '../machine-management/machine-access.resolver';
import { SignalNotFoundError } from '../machine-management/errors/signal-not-found.error';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { InvalidHistoryRangeError } from './errors/invalid-history-range.error';
import {
  HISTORY_READER,
  type HistoryQueryPoint,
  type HistoryResolution,
  type IHistoryReader,
} from './ports/history-reader.port';
import { resolveHistoryResolution } from './resolve-history-resolution';

export type GetSignalHistoryInput = {
  machineId: string;
  signalId: string;
  from: Date;
  to: Date;
  resolution?: HistoryResolution;
  requester: Requester;
};

export type GetSignalHistoryResult = {
  signalId: string;
  resolution: HistoryResolution;
  points: HistoryQueryPoint[];
};

/**
 * docs/specs/08-historicos.md: consulta el histórico de una Signal por rango.
 * Sin `resolution` explícita, la infiere del span (docs/08-frontend-dashboard.md
 * §8.7: el Frontend nunca la elige). Ausencia de datos es un estado válido
 * (`points: []`), nunca un error — mismo criterio que spec 07 al no ramificar
 * por `signalType`.
 */
@Injectable()
export class GetSignalHistoryUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(HISTORY_READER) private readonly historyReader: IHistoryReader,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: GetSignalHistoryInput): Promise<GetSignalHistoryResult> {
    if (input.from >= input.to) {
      throw new InvalidHistoryRangeError(input.from, input.to);
    }

    const signal = await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      const found = await this.signalRepository.findById(input.signalId, ctx);
      if (!found || found.machineId !== machine.id || !found.isActive) {
        throw new SignalNotFoundError(input.signalId, machine.id);
      }
      return found;
    });

    const resolution = input.resolution ?? resolveHistoryResolution(input.from, input.to);
    const points = await this.historyReader.queryRange({
      signalId: signal.id,
      from: input.from,
      to: input.to,
      resolution,
    });

    return { signalId: signal.id, resolution, points };
  }
}

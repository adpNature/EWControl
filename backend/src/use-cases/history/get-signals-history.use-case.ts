import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '../../entities/user-role.enum';
import type { Requester } from '../machine-management/machine-access.resolver';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { classifySignalIdsByCompany } from '../shared/classify-signal-ids-by-company';
import { CompanyIdRequiredError } from './errors/company-id-required.error';
import { InvalidHistoryRangeError } from './errors/invalid-history-range.error';
import { SignalNotFoundForHistoryError } from './errors/signal-not-found-for-history.error';
import {
  HISTORY_READER,
  type HistoryQueryPoint,
  type HistoryResolution,
  type IHistoryReader,
} from './ports/history-reader.port';
import { resolveHistoryResolution } from './resolve-history-resolution';

export type GetSignalsHistoryInput = {
  signalIds: string[];
  from: Date;
  to: Date;
  resolution?: HistoryResolution;
  companyId?: string;
  requester: Requester;
};

export type HistorySeriesResult = {
  signalId: string;
  machineId: string;
  points: HistoryQueryPoint[];
};

export type GetSignalsHistoryResult = {
  resolution: HistoryResolution;
  series: HistorySeriesResult[];
};

/**
 * docs/specs/14-historicos-comparativas.md: histórico comparativo de varias
 * Signals (posiblemente de distintas Machines) en una sola consulta. Reutiliza
 * `resolveHistoryResolution` (spec 08) y `classifySignalIdsByCompany` (extraído
 * del validador de widgets, spec 07) sin duplicar ninguna de las dos reglas.
 */
@Injectable()
export class GetSignalsHistoryUseCase {
  constructor(
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(HISTORY_READER) private readonly historyReader: IHistoryReader,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: GetSignalsHistoryInput): Promise<GetSignalsHistoryResult> {
    if (input.from >= input.to) {
      throw new InvalidHistoryRangeError(input.from, input.to);
    }

    const companyId =
      input.requester.role === UserRole.SuperAdmin ? input.companyId : input.requester.companyId;
    if (!companyId) {
      throw new CompanyIdRequiredError();
    }

    const uniqueSignalIds = [...new Set(input.signalIds)];

    const { valid, invalid } = await this.unitOfWork.runInTransaction((ctx) =>
      classifySignalIdsByCompany(
        uniqueSignalIds,
        companyId,
        { signalRepository: this.signalRepository, machineRepository: this.machineRepository },
        ctx,
      ),
    );
    if (invalid.length > 0) {
      throw new SignalNotFoundForHistoryError(invalid);
    }

    const machineIdBySignalId = new Map(valid.map((signal) => [signal.id, signal.machineId]));
    const resolution = input.resolution ?? resolveHistoryResolution(input.from, input.to);
    const rows = await this.historyReader.queryRangeBatch({
      signalIds: uniqueSignalIds,
      from: input.from,
      to: input.to,
      resolution,
    });

    const pointsBySignalId = new Map<string, HistoryQueryPoint[]>();
    for (const row of rows) {
      const points = pointsBySignalId.get(row.signalId) ?? [];
      points.push({ timestamp: row.timestamp, value: row.value });
      pointsBySignalId.set(row.signalId, points);
    }

    const series = uniqueSignalIds.map((signalId) => ({
      signalId,
      machineId: machineIdBySignalId.get(signalId)!,
      points: pointsBySignalId.get(signalId) ?? [],
    }));

    return { resolution, series };
  }
}

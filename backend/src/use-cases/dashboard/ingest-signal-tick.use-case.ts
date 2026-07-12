import { Inject, Injectable } from '@nestjs/common';
import { REALTIME_CACHE, type IRealtimeCache } from '../../entities/realtime-cache';
import { resolveDirectSignalValue } from '../../entities/signal-engine';
import { SignalQuality } from '../../entities/signal-quality.enum';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import { HISTORY_WRITER, type IHistoryWriter } from '../history/ports/history-writer.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';

export type IngestSignalTickInput = {
  machineId: string;
  variableName: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

/**
 * Signal Engine (Documento 2, apartado 2.5), wiring real de
 * docs/specs/07-dashboard-tiempo-real.md: resuelve únicamente Signals `DIRECT`
 * activas; descarta silenciosamente si la Machine o la Signal no existen o
 * están inactivas, o si `variableName` no corresponde a ninguna Signal DIRECT.
 */
@Injectable()
export class IngestSignalTickUseCase {
  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(REALTIME_CACHE) private readonly realtimeCache: IRealtimeCache,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(HISTORY_WRITER) private readonly historyWriter: IHistoryWriter,
  ) {}

  async execute(input: IngestSignalTickInput): Promise<void> {
    const resolved = await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.machineRepository.findById(input.machineId, ctx);
      if (!machine || !machine.isActive) {
        return null;
      }
      const signal = await this.signalRepository.findActiveDirectByMachineAndVariableName(
        input.machineId,
        input.variableName,
        ctx,
      );
      if (!signal) {
        return null;
      }
      return {
        signalId: signal.id,
        companyId: machine.companyId,
        historyEnabled: signal.historyEnabled,
      };
    });

    if (!resolved) {
      return;
    }

    const { value, quality, timestamp } = resolveDirectSignalValue({
      value: input.value,
      quality: input.quality,
      timestamp: input.timestamp,
    });

    this.realtimeCache.set({
      signalId: resolved.signalId,
      machineId: input.machineId,
      companyId: resolved.companyId,
      value,
      quality,
      timestamp,
      updatedAt: this.clock.now(),
    });
    this.eventPublisher.publish('SignalUpdated', {
      signalId: resolved.signalId,
      machineId: input.machineId,
      companyId: resolved.companyId,
      value,
      quality,
      timestamp,
    });

    if (resolved.historyEnabled && typeof value === 'number') {
      try {
        await this.historyWriter.writeBatch([
          {
            companyId: resolved.companyId,
            machineId: input.machineId,
            signalId: resolved.signalId,
            value,
            timestamp,
          },
        ]);
      } catch {
        // Descarte silencioso (docs/04-persistencia-de-datos.md §4.8, "Tolerancia
        // a Fallos"): un fallo de InfluxDB no interrumpe el tiempo real.
      }
    }
  }
}

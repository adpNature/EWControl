import { Inject, Injectable } from '@nestjs/common';
import { REALTIME_CACHE, type IRealtimeCache } from '../../entities/realtime-cache';
import { SignalQuality } from '../../entities/signal-quality.enum';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';

export type MarkMachineSignalsOfflineInput = { machineId: string; companyId: string };

/**
 * docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 4:
 * al desconectarse una Machine, cada Signal con entrada existente en la
 * Realtime Cache pasa a `OFFLINE` conservando su último valor/timestamp
 * (Documento 2, apartado 2.6, "Gestión de Máquinas Desconectadas").
 */
@Injectable()
export class MarkMachineSignalsOfflineUseCase {
  constructor(
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(REALTIME_CACHE) private readonly realtimeCache: IRealtimeCache,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async execute(input: MarkMachineSignalsOfflineInput): Promise<void> {
    const signals = await this.unitOfWork.runInTransaction((ctx) =>
      this.signalRepository.findAllByMachineId(input.machineId, ctx),
    );

    for (const signal of signals) {
      const entry = this.realtimeCache.get(signal.id);
      if (!entry || entry.quality === SignalQuality.Offline) {
        continue;
      }
      this.realtimeCache.set({
        ...entry,
        quality: SignalQuality.Offline,
        updatedAt: this.clock.now(),
      });
      this.eventPublisher.publish('SignalUpdated', {
        signalId: entry.signalId,
        machineId: entry.machineId,
        companyId: entry.companyId,
        value: entry.value,
        quality: SignalQuality.Offline,
        timestamp: entry.timestamp,
      });
    }
  }
}

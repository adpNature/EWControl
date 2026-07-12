import { Inject, Injectable } from '@nestjs/common';
import {
  REALTIME_CACHE,
  type IRealtimeCache,
  type RealtimeCacheEntry,
} from '../../entities/realtime-cache';
import { SignalValueNotAvailableError } from '../dashboard/errors/signal-value-not-available.error';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { MachineAccessResolver, Requester } from './machine-access.resolver';

export type GetSignalValueInput = { machineId: string; signalId: string; requester: Requester };

/**
 * docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 2: lee
 * directamente de la Realtime Cache; sin entrada (FORMULA o DIRECT sin tick aún)
 * responde `SignalValueNotAvailableError`, sin ninguna rama por `signalType`.
 */
@Injectable()
export class GetSignalValueUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(REALTIME_CACHE) private readonly realtimeCache: IRealtimeCache,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: GetSignalValueInput): Promise<RealtimeCacheEntry> {
    const signal = await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveActive(input.machineId, input.requester, ctx);
      const found = await this.signalRepository.findById(input.signalId, ctx);
      if (!found || found.machineId !== machine.id || !found.isActive) {
        throw new SignalNotFoundError(input.signalId, machine.id);
      }
      return found;
    });

    const entry = this.realtimeCache.get(signal.id);
    if (!entry) {
      throw new SignalValueNotAvailableError(signal.id);
    }
    return entry;
  }
}

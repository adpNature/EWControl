import { Inject, Injectable } from '@nestjs/common';
import { ForcedSignalQuality } from '../../entities/forced-signal-quality.enum';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { SignalNotFoundError } from './errors/signal-not-found.error';
import { type ISimulatorRuntime, SIMULATOR_RUNTIME } from './ports/simulator-runtime.port';
import { SimulatorMachineResolver } from './simulator-machine-resolver';

export type ForceSignalQualityInput = {
  machineId: string;
  signalId: string;
  quality: ForcedSignalQuality;
  durationTicks: number;
};

/**
 * spec 03-simulador-forzar-fallo.md, criterio de aceptación 3: degrada la
 * calidad de una Signal concreta durante `durationTicks` lecturas.
 */
@Injectable()
export class ForceSignalQualityUseCase {
  constructor(
    private readonly resolver: SimulatorMachineResolver,
    @Inject(SIMULATOR_RUNTIME) private readonly simulatorRuntime: ISimulatorRuntime,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ForceSignalQualityInput): Promise<void> {
    await this.resolver.resolve(input.machineId);

    const signal = await this.unitOfWork.runInTransaction((ctx) =>
      this.signalRepository.findById(input.signalId, ctx),
    );
    if (!signal || signal.machineId !== input.machineId) {
      throw new SignalNotFoundError(input.signalId, input.machineId);
    }

    this.simulatorRuntime.forceSignalQuality(
      input.machineId,
      signal.signalSource.variableName,
      input.quality,
      input.durationTicks,
    );
  }
}

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';
import { ProviderType } from '../../../entities/provider-type.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../../../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import {
  type IUnitOfWork,
  UNIT_OF_WORK,
} from '../../../use-cases/seed-demo-environment/ports/unit-of-work.port';
import type { ISimulatorRuntime } from '../../../use-cases/simulator-control/ports/simulator-runtime.port';
import { DataQuality } from '../data-quality.enum';
import { SimulationProvider } from './simulation-provider';

function toDataQuality(quality: ForcedSignalQuality): DataQuality {
  switch (quality) {
    case ForcedSignalQuality.Bad:
      return DataQuality.Bad;
    case ForcedSignalQuality.Uncertain:
      return DataQuality.Uncertain;
  }
}

/**
 * Mantiene la instancia en ejecución de `SimulationProvider` de cada Machine
 * `ProviderType.Simulator` (spec 02), arrancada al iniciar la aplicación, y
 * expone el puerto `ISimulatorRuntime` que consume `simulator-control` (spec 03).
 */
@Injectable()
export class SimulationProviderRegistry implements ISimulatorRuntime, OnModuleInit {
  private readonly providers = new Map<string, SimulationProvider>();

  constructor(
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async onModuleInit(): Promise<void> {
    const connections = await this.unitOfWork.runInTransaction((ctx) =>
      this.machineConnectionRepository.findAllByProviderType(ProviderType.Simulator, ctx),
    );
    for (const connection of connections) {
      const provider = new SimulationProvider(connection.connectionConfig);
      await provider.connect();
      provider.startScheduler();
      this.providers.set(connection.machineId, provider);
    }
  }

  isConnected(machineId: string): boolean {
    return this.require(machineId).isConnected();
  }

  connect(machineId: string): Promise<void> {
    return this.require(machineId).connect();
  }

  disconnect(machineId: string): Promise<void> {
    return this.require(machineId).disconnect();
  }

  forceSignalQuality(
    machineId: string,
    variableName: string,
    quality: ForcedSignalQuality,
    durationTicks: number,
  ): void {
    this.require(machineId).forceQuality(variableName, toDataQuality(quality), durationTicks);
  }

  private require(machineId: string): SimulationProvider {
    const provider = this.providers.get(machineId);
    if (!provider) {
      throw new Error(`No hay SimulationProvider activo para la Machine "${machineId}".`);
    }
    return provider;
  }
}

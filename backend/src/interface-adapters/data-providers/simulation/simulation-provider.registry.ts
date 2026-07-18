import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';
import { ProviderType } from '../../../entities/provider-type.enum';
import { SignalQuality } from '../../../entities/signal-quality.enum';
import { PrometheusMetricsService } from '../../observability/prometheus-metrics.service';
import { IngestSignalTickUseCase } from '../../../use-cases/dashboard/ingest-signal-tick.use-case';
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
import type { Variable } from '../variable.vo';
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
 * Traduce la calidad del Data Provider (Interface Adapters) a la calidad de
 * dominio (Entities) que consume el Signal Engine — el único punto donde se
 * cruza esa frontera (docs/specs/07-dashboard-tiempo-real.md, "Contexto").
 */
function toSignalQuality(quality: DataQuality): SignalQuality {
  switch (quality) {
    case DataQuality.Good:
      return SignalQuality.Good;
    case DataQuality.Bad:
      return SignalQuality.Bad;
    case DataQuality.Uncertain:
      return SignalQuality.Uncertain;
    case DataQuality.Offline:
      return SignalQuality.Offline;
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
    private readonly ingestSignalTick: IngestSignalTickUseCase,
    private readonly metrics: PrometheusMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connections = await this.unitOfWork.runInTransaction((ctx) =>
      this.machineConnectionRepository.findAllByProviderType(ProviderType.Simulator, ctx),
    );
    for (const connection of connections) {
      const provider = new SimulationProvider(connection.connectionConfig);
      provider.subscribe((variable) => this.onVariable(connection.machineId, variable));
      await provider.connect();
      provider.startScheduler();
      this.providers.set(connection.machineId, provider);
      this.metrics.setDataProviderConnected(connection.machineId, true);
    }
  }

  /**
   * Wiring real del Signal Engine (docs/specs/07-dashboard-tiempo-real.md):
   * hasta esta spec, ningún listener consumía las Variables generadas por el
   * Simulador. Un fallo al procesar un tick nunca debe detener el intervalo.
   */
  private onVariable(machineId: string, variable: Variable): void {
    this.ingestSignalTick
      .execute({
        machineId,
        variableName: variable.name,
        value: variable.value,
        quality: toSignalQuality(variable.quality),
        timestamp: variable.timestamp,
        correlationId: variable.correlationId,
      })
      .catch(() => undefined);
  }

  isConnected(machineId: string): boolean {
    return this.require(machineId).isConnected();
  }

  async connect(machineId: string): Promise<void> {
    await this.require(machineId).connect();
    this.metrics.setDataProviderConnected(machineId, true);
  }

  async disconnect(machineId: string): Promise<void> {
    await this.require(machineId).disconnect();
    this.metrics.setDataProviderConnected(machineId, false);
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

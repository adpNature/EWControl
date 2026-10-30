import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SimulatorConnectionConfig } from '../../../entities/connection-config.vo';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';
import { ProviderType } from '../../../entities/provider-type.enum';
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
import type { MachineConnectionReplacedPayload } from '../../../use-cases/simulator-control/ports/event-publisher.port';
import type { ISimulatorRuntime } from '../../../use-cases/simulator-control/ports/simulator-runtime.port';
import { DataQuality } from '../data-quality.enum';
import { forwardVariableToSignalEngine } from '../variable-ingestion';
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
 * Desde docs/specs/18-integracion-opc-ua.md también para o arranca el provider
 * en caliente cuando cambia la `MachineConnection` de una Machine.
 */
@Injectable()
export class SimulationProviderRegistry implements ISimulatorRuntime, OnModuleInit {
  private readonly logger = new Logger(SimulationProviderRegistry.name);
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
      await this.start(
        connection.machineId,
        connection.connectionConfig as SimulatorConnectionConfig,
      );
    }
  }

  /**
   * spec 18, criterio backend 2: si la Machine deja de ser Simulator, su provider
   * se detiene; si pasa a serlo (o cambia su config), arranca uno nuevo.
   */
  @OnEvent('MachineConnectionReplaced')
  async onMachineConnectionReplaced(payload: MachineConnectionReplacedPayload): Promise<void> {
    try {
      if (payload.previousProviderType === ProviderType.Simulator) {
        await this.stop(payload.machineId);
      }
      if (payload.providerType !== ProviderType.Simulator) {
        return;
      }
      const connection = await this.unitOfWork.runInTransaction((ctx) =>
        this.machineConnectionRepository.findByMachineId(payload.machineId, ctx),
      );
      if (connection?.providerType === ProviderType.Simulator) {
        await this.start(
          connection.machineId,
          connection.connectionConfig as SimulatorConnectionConfig,
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudo aplicar el cambio de conexión de la Machine ${payload.machineId}: ${(error as Error).message}`,
      );
    }
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

  /**
   * Wiring real del Signal Engine (docs/specs/07-dashboard-tiempo-real.md): un
   * fallo al procesar un tick nunca debe detener el intervalo.
   */
  private async start(machineId: string, config: SimulatorConnectionConfig): Promise<void> {
    const provider = new SimulationProvider(config);
    provider.subscribe((variable) =>
      forwardVariableToSignalEngine(this.ingestSignalTick, machineId, variable),
    );
    await provider.connect();
    provider.startScheduler();
    this.providers.set(machineId, provider);
    this.metrics.setDataProviderConnected(machineId, true);
  }

  private async stop(machineId: string): Promise<void> {
    const provider = this.providers.get(machineId);
    if (!provider) {
      return;
    }
    this.providers.delete(machineId);
    provider.stopScheduler();
    await provider.disconnect();
    this.metrics.setDataProviderConnected(machineId, false);
  }

  private require(machineId: string): SimulationProvider {
    const provider = this.providers.get(machineId);
    if (!provider) {
      throw new Error(`No hay SimulationProvider activo para la Machine "${machineId}".`);
    }
    return provider;
  }
}

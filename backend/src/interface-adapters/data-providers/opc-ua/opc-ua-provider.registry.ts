import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { OpcUaConnectionConfig } from '../../../entities/connection-config.vo';
import { ProviderType } from '../../../entities/provider-type.enum';
import { IngestSignalTickUseCase } from '../../../use-cases/dashboard/ingest-signal-tick.use-case';
import { CLOCK, type IClock } from '../../../use-cases/history/ports/clock.port';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../../../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../../../use-cases/seed-demo-environment/ports/machine-repository.port';
import {
  type IUnitOfWork,
  UNIT_OF_WORK,
} from '../../../use-cases/seed-demo-environment/ports/unit-of-work.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
  type MachineConnectionReplacedPayload,
  type MachineDeactivatedPayload,
  type MachineSignalsChangedPayload,
} from '../../../use-cases/simulator-control/ports/event-publisher.port';
import { MachineNotConnectedError } from '../../../use-cases/write-packages/errors/machine-not-connected.error';
import { WriteInProgressError } from '../../../use-cases/write-packages/errors/write-in-progress.error';
import { WriteTimeoutError } from '../../../use-cases/write-packages/errors/write-timeout.error';
import type {
  IMachineWriter,
  MachineWriteItem,
  MachineWriteResult,
} from '../../../use-cases/write-packages/ports/machine-writer.port';
import { PrometheusMetricsService } from '../../observability/prometheus-metrics.service';
import { OpcUaTimeoutError } from './node-opcua.mappers';
import { forwardVariableToSignalEngine } from '../variable-ingestion';
import {
  OPCUA_DRIVER_FACTORY,
  type OpcUaDriverFactory,
  OpcUaSessionUnavailableError,
} from './opc-ua-driver.port';
import { OpcUaProvider } from './opc-ua-provider';

type RunningProvider = { provider: OpcUaProvider; companyId: string; hasConnected: boolean };

/**
 * Mantiene un `OpcUaProvider` por cada Machine activa `ProviderType.OpcUa`
 * (docs/specs/18-integracion-opc-ua.md), igual que `SimulationProviderRegistry`
 * para el Simulador. Traduce sus cambios de conexión a `MachineConnected` /
 * `MachineDisconnected` y a métricas (criterio backend 8), y para/arranca
 * providers en caliente ante `MachineConnectionReplaced`/`MachineDeactivated`
 * (criterio 2). Un endpoint inalcanzable nunca bloquea el arranque (criterio 9).
 * Desde docs/specs/20-paquetes-escritura-opc-ua.md implementa `IMachineWriter`:
 * escribe con la sesión de la Machine, una escritura a la vez por Machine.
 */
@Injectable()
export class OpcUaProviderRegistry implements OnModuleInit, OnModuleDestroy, IMachineWriter {
  private readonly logger = new Logger(OpcUaProviderRegistry.name);
  private readonly running = new Map<string, RunningProvider>();
  private readonly writing = new Set<string>();

  constructor(
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly ingestSignalTick: IngestSignalTickUseCase,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly metrics: PrometheusMetricsService,
    @Inject(OPCUA_DRIVER_FACTORY) private readonly driverFactory: OpcUaDriverFactory,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  async onModuleInit(): Promise<void> {
    const connections = await this.unitOfWork.runInTransaction((ctx) =>
      this.machineConnectionRepository.findAllByProviderType(ProviderType.OpcUa, ctx),
    );
    for (const connection of connections) {
      await this.startFromRepository(connection.machineId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.running.keys()].map((machineId) => this.stop(machineId)));
  }

  @OnEvent('MachineConnectionReplaced')
  async onMachineConnectionReplaced(payload: MachineConnectionReplacedPayload): Promise<void> {
    try {
      if (payload.previousProviderType === ProviderType.OpcUa) {
        await this.stop(payload.machineId);
      }
      if (payload.providerType === ProviderType.OpcUa) {
        await this.startFromRepository(payload.machineId);
      }
    } catch (error) {
      this.logger.error(
        `No se pudo aplicar el cambio de conexión de la Machine ${payload.machineId}: ${(error as Error).message}`,
      );
    }
  }

  @OnEvent('MachineDeactivated')
  async onMachineDeactivated(payload: MachineDeactivatedPayload): Promise<void> {
    await this.stop(payload.machineId);
  }

  /**
   * spec 18: una Signal creada o editada después de suscribirse no recibiría
   * valor hasta que el PLC cambie; se republican los últimos valores conocidos.
   */
  @OnEvent('MachineSignalsChanged')
  onMachineSignalsChanged(payload: MachineSignalsChangedPayload): void {
    this.running.get(payload.machineId)?.provider.republishLastValues();
  }

  /**
   * spec 20, criterios backend 4 y 6: sin sesión, `MachineNotConnectedError`; con
   * otra escritura en curso en la misma Machine, `WriteInProgressError` (no se encola).
   */
  async write(machineId: string, items: MachineWriteItem[]): Promise<MachineWriteResult[]> {
    const entry = this.running.get(machineId);
    if (!entry?.provider.isConnected()) {
      throw new MachineNotConnectedError(machineId);
    }
    if (this.writing.has(machineId)) {
      throw new WriteInProgressError(machineId);
    }
    this.writing.add(machineId);
    try {
      return await entry.provider.write(items);
    } catch (error) {
      if (error instanceof OpcUaTimeoutError) {
        throw new WriteTimeoutError();
      }
      if (error instanceof OpcUaSessionUnavailableError) {
        throw new MachineNotConnectedError(machineId);
      }
      throw error;
    } finally {
      this.writing.delete(machineId);
    }
  }

  /** Solo para diagnóstico y tests: si la Machine tiene provider y está conectado. */
  isConnected(machineId: string): boolean {
    return this.running.get(machineId)?.provider.isConnected() ?? false;
  }

  hasProvider(machineId: string): boolean {
    return this.running.has(machineId);
  }

  private async startFromRepository(machineId: string): Promise<void> {
    const loaded = await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.machineRepository.findById(machineId, ctx);
      const connection = await this.machineConnectionRepository.findByMachineId(machineId, ctx);
      return { machine, connection };
    });
    const { machine, connection } = loaded;
    if (!machine?.isActive || connection?.providerType !== ProviderType.OpcUa) {
      return;
    }
    this.start(machineId, machine.companyId, connection.connectionConfig as OpcUaConnectionConfig);
  }

  private start(machineId: string, companyId: string, config: OpcUaConnectionConfig): void {
    const provider = new OpcUaProvider(machineId, config, this.driverFactory(config), () =>
      this.clock.now(),
    );
    const entry: RunningProvider = { provider, companyId, hasConnected: false };
    provider.subscribe((variable) =>
      forwardVariableToSignalEngine(this.ingestSignalTick, machineId, variable),
    );
    provider.onConnectionChange((connected) =>
      this.handleConnectionChange(machineId, entry, connected),
    );
    this.running.set(machineId, entry);
    this.metrics.setDataProviderConnected(machineId, false);
    void provider.connect();
    this.logger.log(`OpcUaProvider iniciado para la Machine ${machineId} (${config.endpointUrl}).`);
  }

  private handleConnectionChange(
    machineId: string,
    entry: RunningProvider,
    connected: boolean,
  ): void {
    this.metrics.setDataProviderConnected(machineId, connected);
    const payload = { machineId, companyId: entry.companyId, timestamp: this.clock.now() };
    if (connected) {
      if (entry.hasConnected) {
        this.metrics.incrementDataProviderReconnect(machineId);
      }
      entry.hasConnected = true;
      this.eventPublisher.publish('MachineConnected', payload);
      return;
    }
    this.eventPublisher.publish('MachineDisconnected', payload);
  }

  private async stop(machineId: string): Promise<void> {
    const entry = this.running.get(machineId);
    if (!entry) {
      return;
    }
    this.running.delete(machineId);
    try {
      await entry.provider.disconnect();
    } catch (error) {
      this.logger.warn(
        `Error al detener el OpcUaProvider de la Machine ${machineId}: ${(error as Error).message}`,
      );
    }
    this.metrics.setDataProviderConnected(machineId, false);
  }
}

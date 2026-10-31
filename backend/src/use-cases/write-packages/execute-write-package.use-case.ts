import { Inject, Injectable } from '@nestjs/common';
import { ProviderType } from '../../entities/provider-type.enum';
import { WritePackageExecutionStatus } from '../../entities/write-package-execution-status.enum';
import type {
  WritePackageExecution,
  WritePackageExecutionItem,
} from '../../entities/write-package-execution.entity';
import type { WritePackage } from '../../entities/write-package.entity';
import {
  executionStatusFrom,
  findWritableVariable,
  validateWritePackageItems,
} from '../../entities/write-package.vo';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import { ProviderNotSupportedError } from '../machine-management/errors/provider-not-supported.error';
import type { Requester } from '../machine-management/machine-access.resolver';
import {
  METRICS_RECORDER,
  type IMetricsRecorder,
} from '../observability/ports/metrics-recorder.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';
import { MachineNotConnectedError } from './errors/machine-not-connected.error';
import { WriteInProgressError } from './errors/write-in-progress.error';
import { WritePackageOutdatedError } from './errors/write-package-outdated.error';
import { WriteTimeoutError } from './errors/write-timeout.error';
import {
  type IMachineWriter,
  MACHINE_WRITER,
  type MachineWriteItem,
} from './ports/machine-writer.port';
import {
  type IWritePackageExecutionRepository,
  WRITE_PACKAGE_EXECUTION_REPOSITORY,
} from './ports/write-package-execution-repository.port';
import { NO_CONNECTION_CONFIG, WritePackageAccessResolver } from './write-package-access.resolver';

export type ExecuteWritePackageInput = {
  machineId: string;
  packageId: string;
  requester: Requester;
  /** Quién ejecuta: queda en la auditoría (criterio backend 8). */
  executedBy: { userId: string; email: string };
};

const NOT_SENT = 'NOT_SENT';

type ExecutionContext = {
  input: ExecuteWritePackageInput;
  writePackage: WritePackage;
  companyId: string;
};

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, criterios backend 4 a 8. Revalida
 * el paquete contra la configuración **actual** de la Machine y escribe todos
 * sus valores en una sola petición. Toda ejecución queda registrada, también
 * las rechazadas antes de escribir: en ese caso se registra como `FAILED` con
 * su motivo y después se lanza el error correspondiente.
 */
@Injectable()
export class ExecuteWritePackageUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_EXECUTION_REPOSITORY)
    private readonly executionRepository: IWritePackageExecutionRepository,
    @Inject(MACHINE_WRITER) private readonly machineWriter: IMachineWriter,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(METRICS_RECORDER) private readonly metricsRecorder: IMetricsRecorder,
  ) {}

  /**
   * @throws MachineNotFoundError / WritePackageNotFoundError (antes de registrar nada).
   * @throws ProviderNotSupportedError / WritePackageOutdatedError / MachineNotConnectedError /
   *   WriteInProgressError (tras registrar la ejecución como `FAILED`).
   */
  async execute(input: ExecuteWritePackageInput): Promise<WritePackageExecution> {
    const { machine, providerType, connectionConfig, writePackage } =
      await this.unitOfWork.runInTransaction(async (ctx) => {
        const resolved = await this.access.resolveMachine(input.machineId, input.requester, ctx);
        const found = await this.access.resolvePackage(resolved.machine.id, input.packageId, ctx);
        return { ...resolved, writePackage: found };
      });
    const context: ExecutionContext = { input, writePackage, companyId: machine.companyId };
    const config = connectionConfig ?? NO_CONNECTION_CONFIG;

    if (providerType !== ProviderType.OpcUa) {
      await this.reject(context, 'PROVIDER_NOT_SUPPORTED');
      throw new ProviderNotSupportedError(providerType ?? 'ninguno');
    }
    const validation = validateWritePackageItems(writePackage.items, config);
    if (!validation.ok) {
      await this.reject(context, 'WRITE_PACKAGE_OUTDATED');
      throw new WritePackageOutdatedError(validation.reason);
    }

    const writeItems: MachineWriteItem[] = writePackage.items.map((item) => {
      const variable = findWritableVariable(config, item.signalVariableName)!;
      return { nodeId: variable.nodeId, dataType: variable.dataType, value: item.value };
    });

    let statusCodes: string[];
    let reason: string | null = null;
    try {
      const results = await this.machineWriter.write(machine.id, writeItems);
      statusCodes = writeItems.map((item, index) => results[index]?.statusCode ?? NOT_SENT);
    } catch (error) {
      if (error instanceof WriteTimeoutError) {
        // Algún valor pudo llegar a escribirse: el historial lo advierte con el motivo.
        reason = 'TIMEOUT';
        statusCodes = writeItems.map(() => 'TIMEOUT');
      } else if (error instanceof MachineNotConnectedError) {
        await this.reject(context, 'MACHINE_NOT_CONNECTED');
        throw error;
      } else if (error instanceof WriteInProgressError) {
        await this.reject(context, 'WRITE_IN_PROGRESS');
        throw error;
      } else {
        throw error;
      }
    }

    const items: WritePackageExecutionItem[] = writePackage.items.map((item, index) => ({
      signalVariableName: item.signalVariableName,
      nodeId: writeItems[index].nodeId,
      value: item.value,
      statusCode: statusCodes[index],
    }));
    return this.record(context, executionStatusFrom(statusCodes), reason, items);
  }

  private reject(context: ExecutionContext, reason: string): Promise<WritePackageExecution> {
    const items = context.writePackage.items.map((item) => ({
      signalVariableName: item.signalVariableName,
      nodeId: null,
      value: item.value,
      statusCode: NOT_SENT,
    }));
    return this.record(context, WritePackageExecutionStatus.Failed, reason, items);
  }

  private async record(
    context: ExecutionContext,
    status: WritePackageExecutionStatus,
    reason: string | null,
    items: WritePackageExecutionItem[],
  ): Promise<WritePackageExecution> {
    const { input, writePackage, companyId } = context;
    const execution = await this.unitOfWork.runInTransaction((ctx) =>
      this.executionRepository.create(
        {
          packageId: writePackage.id,
          machineId: writePackage.machineId,
          companyId,
          userId: input.executedBy.userId,
          userEmail: input.executedBy.email,
          executedAt: this.clock.now(),
          status,
          reason,
          items,
        },
        ctx,
      ),
    );
    this.metricsRecorder.recordWritePackageExecution(status);
    this.eventPublisher.publish('WritePackageExecuted', {
      executionId: execution.id,
      packageId: writePackage.id,
      machineId: writePackage.machineId,
      companyId,
      status,
    });
    return execution;
  }
}

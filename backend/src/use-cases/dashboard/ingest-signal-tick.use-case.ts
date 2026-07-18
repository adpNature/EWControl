import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REALTIME_CACHE,
  type IRealtimeCache,
  type RealtimeCacheEntry,
} from '../../entities/realtime-cache';
import { RAW_VARIABLE_CACHE, type IRawVariableCache } from '../../entities/raw-variable-cache';
import {
  resolveDirectSignalValue,
  resolveFormulaSignalValue,
  type FormulaVariableInput,
  type ResolvedSignalValue,
} from '../../entities/signal-engine';
import { SignalQuality } from '../../entities/signal-quality.enum';
import type { FormulaSignalSource } from '../../entities/signal-source.vo';
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
  METRICS_RECORDER,
  type IMetricsRecorder,
} from '../observability/ports/metrics-recorder.port';
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
  /** docs/07-observabilidad-monitorizacion.md, apartado 7.6 (spec 15). */
  correlationId: string;
};

type ResolvedDirectSignal = { signalId: string; historyEnabled: boolean };
type ResolvedFormulaSignal = {
  signalId: string;
  expression: string;
  variables: string[];
  historyEnabled: boolean;
};

type ResolvedTick = {
  companyId: string;
  directSignal?: ResolvedDirectSignal;
  formulaSignals: ResolvedFormulaSignal[];
};

/**
 * Signal Engine (Documento 2, apartado 2.5). Wiring real de
 * docs/specs/07-dashboard-tiempo-real.md (Signals `DIRECT`) y
 * docs/specs/13-motor-formulas-signal-engine.md (Signals `FORMULA`): descarta
 * silenciosamente si la Machine no existe o está inactiva; para una Machine
 * activa, memoriza siempre el tick en el `RawVariableCache` (detalle interno,
 * nunca expuesto), resuelve la Signal `DIRECT` que expone esa Variable (si
 * existe) y cada Signal `FORMULA` activa que la referencia.
 */
@Injectable()
export class IngestSignalTickUseCase {
  private readonly logger = new Logger(IngestSignalTickUseCase.name);

  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(REALTIME_CACHE) private readonly realtimeCache: IRealtimeCache,
    @Inject(RAW_VARIABLE_CACHE) private readonly rawVariableCache: IRawVariableCache,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(HISTORY_WRITER) private readonly historyWriter: IHistoryWriter,
    @Inject(METRICS_RECORDER) private readonly metricsRecorder: IMetricsRecorder,
  ) {}

  async execute(input: IngestSignalTickInput): Promise<void> {
    const resolved = await this.unitOfWork.runInTransaction<ResolvedTick | null>(async (ctx) => {
      const machine = await this.machineRepository.findById(input.machineId, ctx);
      if (!machine || !machine.isActive) {
        return null;
      }

      const [directSignal, formulaSignals] = await Promise.all([
        this.signalRepository.findActiveDirectByMachineAndVariableName(
          input.machineId,
          input.variableName,
          ctx,
        ),
        this.signalRepository.findActiveFormulasByMachineAndVariableName(
          input.machineId,
          input.variableName,
          ctx,
        ),
      ]);

      return {
        companyId: machine.companyId,
        directSignal: directSignal
          ? { signalId: directSignal.id, historyEnabled: directSignal.historyEnabled }
          : undefined,
        formulaSignals: formulaSignals.map((signal) => {
          const source = signal.signalSource as FormulaSignalSource;
          return {
            signalId: signal.id,
            expression: source.expression,
            variables: source.variables,
            historyEnabled: signal.historyEnabled,
          };
        }),
      };
    });

    if (!resolved) {
      return;
    }

    this.rawVariableCache.set(input.machineId, input.variableName, {
      value: input.value,
      quality: input.quality,
      timestamp: input.timestamp,
    });

    if (resolved.directSignal) {
      await this.updateDirectSignal(input, resolved.companyId, resolved.directSignal);
    }

    for (const formulaSignal of resolved.formulaSignals) {
      await this.updateFormulaSignal(input, resolved.companyId, formulaSignal);
    }
  }

  private async updateDirectSignal(
    input: IngestSignalTickInput,
    companyId: string,
    directSignal: ResolvedDirectSignal,
  ): Promise<void> {
    const resolvedValue = resolveDirectSignalValue({
      value: input.value,
      quality: input.quality,
      timestamp: input.timestamp,
    });

    this.publishSignalUpdate(
      directSignal.signalId,
      input.machineId,
      companyId,
      resolvedValue,
      input.correlationId,
    );
    await this.writeHistoryIfEnabled(
      companyId,
      input.machineId,
      directSignal.signalId,
      directSignal.historyEnabled,
      resolvedValue,
    );
  }

  private async updateFormulaSignal(
    input: IngestSignalTickInput,
    companyId: string,
    formulaSignal: ResolvedFormulaSignal,
  ): Promise<void> {
    const variableInputs: Record<string, FormulaVariableInput> = {};
    for (const variableName of formulaSignal.variables) {
      const entry = this.rawVariableCache.get(input.machineId, variableName);
      if (!entry) {
        // Al menos una Variable de la fórmula todavía no ha tickeado: se omite
        // el cálculo (spec 13, "Variable sin ningún tick todavía"), sin valor por defecto.
        return;
      }
      variableInputs[variableName] = entry;
    }

    let resolvedValue: ResolvedSignalValue;
    try {
      resolvedValue = resolveFormulaSignalValue({
        expression: formulaSignal.expression,
        variableInputs,
      });
    } catch (error) {
      this.handleFormulaEvaluationError(
        formulaSignal.signalId,
        input.machineId,
        companyId,
        input.timestamp,
        input.correlationId,
        error as Error,
      );
      return;
    }

    this.publishSignalUpdate(
      formulaSignal.signalId,
      input.machineId,
      companyId,
      resolvedValue,
      input.correlationId,
    );
    await this.writeHistoryIfEnabled(
      companyId,
      input.machineId,
      formulaSignal.signalId,
      formulaSignal.historyEnabled,
      resolvedValue,
    );
  }

  /**
   * Ante un error de cálculo (división por cero, Variable no numérica, expresión
   * inválida), mantiene el último valor válido con calidad `BAD` y el timestamp
   * del tick que provocó el error; si nunca hubo un valor válido previo, omite
   * la actualización (docs/02-arquitectura.md, apartado 2.5, "Errores").
   */
  private handleFormulaEvaluationError(
    signalId: string,
    machineId: string,
    companyId: string,
    tickTimestamp: Date,
    correlationId: string,
    error: Error,
  ): void {
    this.logger.error({
      correlationId,
      signalId,
      machineId,
      msg: `No se pudo evaluar la Signal FORMULA ${signalId}: ${error.message}`,
    });

    const existing = this.realtimeCache.get(signalId);
    if (!existing) {
      return;
    }

    this.publishSignalUpdate(
      signalId,
      machineId,
      companyId,
      {
        value: existing.value,
        quality: SignalQuality.Bad,
        timestamp: tickTimestamp,
      },
      correlationId,
    );
  }

  private publishSignalUpdate(
    signalId: string,
    machineId: string,
    companyId: string,
    resolved: ResolvedSignalValue,
    correlationId: string,
  ): void {
    const entry: RealtimeCacheEntry = {
      signalId,
      machineId,
      companyId,
      value: resolved.value,
      quality: resolved.quality,
      timestamp: resolved.timestamp,
      updatedAt: this.clock.now(),
      correlationId,
    };
    this.realtimeCache.set(entry);
    this.eventPublisher.publish('SignalUpdated', {
      signalId,
      machineId,
      companyId,
      value: resolved.value,
      quality: resolved.quality,
      timestamp: resolved.timestamp,
      correlationId,
    });
    this.logger.debug({
      correlationId,
      signalId,
      machineId,
      msg: 'Signal actualizada en la Realtime Cache',
    });
  }

  private async writeHistoryIfEnabled(
    companyId: string,
    machineId: string,
    signalId: string,
    historyEnabled: boolean,
    resolved: ResolvedSignalValue,
  ): Promise<void> {
    if (!historyEnabled || typeof resolved.value !== 'number') {
      return;
    }
    try {
      await this.historyWriter.writeBatch([
        {
          companyId,
          machineId,
          signalId,
          value: resolved.value,
          timestamp: resolved.timestamp,
        },
      ]);
    } catch {
      // Descarte silencioso (docs/04-persistencia-de-datos.md §4.8, "Tolerancia
      // a Fallos"): un fallo de InfluxDB no interrumpe el tiempo real. Se
      // registra como métrica (spec 15) para que sea observable en /metrics.
      this.metricsRecorder.recordHistoryWriteError();
    }
  }
}

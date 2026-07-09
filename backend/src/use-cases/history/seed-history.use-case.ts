import { Inject, Injectable } from '@nestjs/common';
import { ISignalTickGenerator } from '../../interface-adapters/data-providers/simulation/signal-tick-generator';
import { createSignalTickGenerator } from '../../interface-adapters/data-providers/simulation/signal-tick-generator';
import { SignalType } from '../../entities/signal-type.enum';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineNotFoundError } from '../simulator-control/errors/machine-not-found.error';
import { SimulatorMachineResolver } from '../simulator-control/simulator-machine-resolver';
import { HistoryAlreadySeededError } from './errors/history-already-seeded.error';
import { type IClock, CLOCK } from './ports/clock.port';
import { type IHistoryWriter, HISTORY_WRITER, HistoryPoint } from './ports/history-writer.port';
import { type IRandomSource, RANDOM_SOURCE } from './ports/random-source.port';

const TICK_INTERVAL_MS = 1000;
const RANGE_DAYS = 7;
const BATCH_SIZE = 5000;
const CLEANUP_DELETE_ATTEMPTS = 3;
const CLEANUP_RETRY_DELAY_MS = 300;

export type SeedHistoryInput = {
  machineId: string;
  force?: boolean;
  /** Rango a sembrar en ms; por defecto 7 días. Inyectable para tests de integración rápidos. */
  rangeMs?: number;
};

export type SeedHistoryResult = {
  machineId: string;
  from: Date;
  to: Date;
  signalsSeeded: number;
};

type GeneratorEntry = { signalId: string; generator: ISignalTickGenerator };

/**
 * spec 04-simulador-seed-historico.md: rellena retroactivamente InfluxDB con
 * lecturas del mismo random walk acotado que la generación en vivo (Documento
 * 10, apartado 10.1), para que los endpoints de histórico/agregaciones tengan
 * datos desde el primer arranque, sin esperar días de Simulador corriendo.
 */
@Injectable()
export class SeedHistoryUseCase {
  constructor(
    private readonly resolver: SimulatorMachineResolver,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(HISTORY_WRITER) private readonly historyWriter: IHistoryWriter,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(RANDOM_SOURCE) private readonly randomSource: IRandomSource,
  ) {}

  async execute(input: SeedHistoryInput): Promise<SeedHistoryResult> {
    const connection = await this.resolver.resolve(input.machineId);

    const { companyId, signals } = await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.machineRepository.findById(input.machineId, ctx);
      if (!machine) {
        throw new MachineNotFoundError(input.machineId);
      }
      const signals = await this.signalRepository.findAllByMachineId(input.machineId, ctx);
      return { companyId: machine.companyId, signals };
    });

    const to = this.clock.now();
    const rangeMs = input.rangeMs ?? RANGE_DAYS * 24 * 60 * 60 * 1000;
    const from = new Date(to.getTime() - rangeMs);

    const hasData = await this.historyWriter.hasDataInRange(input.machineId, from, to);
    if (hasData) {
      if (!input.force) {
        throw new HistoryAlreadySeededError(input.machineId);
      }
      // Se borra desde el origen, no solo desde `from`: una siembra anterior con
      // `to` ligeramente distinto (el reloj avanza entre llamadas) dejaría un
      // remanente justo antes del nuevo `from` si solo se borrara [from, to].
      await this.historyWriter.deleteRange(input.machineId, new Date(0), to);
    }

    const generators: GeneratorEntry[] = [];
    for (const signal of signals) {
      if (signal.signalType !== SignalType.DIRECT || !signal.historyEnabled) {
        continue;
      }
      const seed = connection.connectionConfig.signals.find(
        (candidate) => candidate.variableName === signal.signalSource.variableName,
      );
      if (!seed) {
        continue;
      }
      generators.push({
        signalId: signal.id,
        generator: createSignalTickGenerator(seed, () => this.randomSource.next()),
      });
    }

    try {
      let batch: HistoryPoint[] = [];
      for (let elapsedMs = 0; elapsedMs <= rangeMs; elapsedMs += TICK_INTERVAL_MS) {
        const timestamp = new Date(from.getTime() + elapsedMs);
        for (const { signalId, generator } of generators) {
          const rawValue = generator.tick();
          const value = typeof rawValue === 'boolean' ? (rawValue ? 1 : 0) : rawValue;
          batch.push({ companyId, machineId: input.machineId, signalId, value, timestamp });
          if (batch.length >= BATCH_SIZE) {
            await this.historyWriter.writeBatch(batch);
            batch = [];
          }
        }
      }
      if (batch.length > 0) {
        await this.historyWriter.writeBatch(batch);
      }
    } catch (error) {
      await this.deleteRangeBestEffort(input.machineId, from, to);
      throw error;
    }

    return { machineId: input.machineId, from, to, signalsSeeded: generators.length };
  }

  /**
   * InfluxDB puede tardar un instante en indexar un lote recién escrito antes
   * de que un borrado por predicado lo alcance (consistencia eventual del motor
   * de series temporales); reintentar el borrado un par de veces cubre ese margen
   * sin comprometer el requisito de "todo o nada" de la spec.
   */
  private async deleteRangeBestEffort(machineId: string, from: Date, to: Date): Promise<void> {
    for (let attempt = 0; attempt < CLEANUP_DELETE_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, CLEANUP_RETRY_DELAY_MS));
      }
      try {
        await this.historyWriter.deleteRange(machineId, from, to);
      } catch {
        // un fallo de limpieza no debe enmascarar el error original de la escritura
      }
    }
  }
}

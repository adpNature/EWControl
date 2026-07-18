import { randomUUID } from 'crypto';
import type { ConnectionConfig } from '../../../entities/connection-config.vo';
import type { IDataProvider, VariableListener } from '../data-provider';
import { DataQuality } from '../data-quality.enum';
import type { Variable } from '../variable.vo';
import type { RandomFn } from './random-walk';
import { createSignalTickGenerator, type ISignalTickGenerator } from './signal-tick-generator';

/**
 * Data Provider que sintetiza valores de Signal mediante random walk acotado
 * (Documento 10, apartado 10.1), sin necesidad de hardware real. Implementa
 * `IDataProvider` como cualquier otro proveedor (Documento 10, "Decisión Arquitectónica").
 */
export class SimulationProvider implements IDataProvider {
  private connected = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly listeners = new Set<VariableListener>();
  private readonly generators: ISignalTickGenerator[];
  private readonly forcedQualities = new Map<
    string,
    { quality: DataQuality; remainingTicks: number }
  >();

  constructor(
    connectionConfig: ConnectionConfig,
    private readonly random: RandomFn = Math.random,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.generators = connectionConfig.signals.map((seed) =>
      createSignalTickGenerator(seed, this.random),
    );
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(listener: VariableListener): void {
    this.listeners.add(listener);
  }

  unsubscribe(listener: VariableListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Degrada la calidad de una Signal durante las próximas `durationTicks` lecturas
   * (spec 03-simulador-forzar-fallo, criterio de aceptación 3); pasado ese número
   * de ticks, vuelve a `GOOD` automáticamente sin intervención manual.
   */
  forceQuality(variableName: string, quality: DataQuality, durationTicks: number): void {
    this.forcedQualities.set(variableName, { quality, remainingTicks: durationTicks });
  }

  /**
   * Avanza un tick de generación: mientras `isConnected()`, genera un nuevo valor
   * por cada Signal configurada y lo publica a los listeners suscritos (spec 02,
   * criterios de aceptación 1 y 6). Invocable directamente desde tests; en
   * producción lo dispara `startScheduler()`.
   */
  tick(): void {
    if (!this.connected) {
      return;
    }
    const timestamp = this.clock();
    for (const generator of this.generators) {
      const variable: Variable = {
        name: generator.variableName,
        value: generator.tick(),
        type: generator.variableType,
        timestamp,
        quality: this.resolveQuality(generator.variableName),
        correlationId: randomUUID(),
      };
      for (const listener of this.listeners) {
        listener(variable);
      }
    }
  }

  private resolveQuality(variableName: string): DataQuality {
    const forced = this.forcedQualities.get(variableName);
    if (!forced) {
      return DataQuality.Good;
    }
    forced.remainingTicks -= 1;
    if (forced.remainingTicks <= 0) {
      this.forcedQualities.delete(variableName);
    }
    return forced.quality;
  }

  /** Dispara `tick()` cada `intervalMs` (1000 por defecto, Documento 10, apartado 10.1). */
  startScheduler(intervalMs = 1000): void {
    this.stopScheduler();
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}

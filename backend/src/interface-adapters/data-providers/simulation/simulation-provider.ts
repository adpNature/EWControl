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
    this.stopScheduler();
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
        // La degradación de calidad (spec 03-simulador-forzar-fallo) sustituirá
        // esta constante por una consulta al estado forzado de la Signal.
        quality: DataQuality.Good,
      };
      for (const listener of this.listeners) {
        listener(variable);
      }
    }
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

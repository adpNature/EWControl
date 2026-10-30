import { SignalQuality } from '../../entities/signal-quality.enum';
import type { IngestSignalTickUseCase } from '../../use-cases/dashboard/ingest-signal-tick.use-case';
import { DataQuality } from './data-quality.enum';
import type { Variable } from './variable.vo';

/**
 * Traduce la calidad del Data Provider (Interface Adapters) a la calidad de
 * dominio (Entities) que consume el Signal Engine — el único punto donde se
 * cruza esa frontera (docs/specs/07-dashboard-tiempo-real.md, "Contexto"),
 * compartido por todos los registries de Data Providers (spec 18).
 */
export function toSignalQuality(quality: DataQuality): SignalQuality {
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
 * Entrega una Variable publicada por cualquier Data Provider al Signal Engine
 * (docs/specs/07-dashboard-tiempo-real.md). Un fallo al procesarla nunca debe
 * propagarse al provider (intervalo del Simulador, Subscription de OPC UA).
 */
export function forwardVariableToSignalEngine(
  ingestSignalTick: IngestSignalTickUseCase,
  machineId: string,
  variable: Variable,
): void {
  ingestSignalTick
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

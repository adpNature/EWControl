import { Signal } from '../../entities/signal.entity';
import type { IMachineRepository } from '../seed-demo-environment/ports/machine-repository.port';
import type { ISignalRepository } from '../seed-demo-environment/ports/signal-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';

export type SignalIdsClassification = { valid: Signal[]; invalid: string[] };

/**
 * Clasifica una lista de `signalId` según si cada uno existe, está activo y su
 * Machine pertenece a `companyId` — extraído de `validate-widget-signal-ids.ts`
 * (docs/specs/07-dashboard-tiempo-real.md) para reutilizarlo también en la
 * validación de la comparativa de históricos (docs/specs/14-historicos-comparativas.md).
 * No lanza ningún error: cada caller decide qué excepción propia lanzar ante `invalid`.
 */
export async function classifySignalIdsByCompany(
  signalIds: string[],
  companyId: string,
  deps: { signalRepository: ISignalRepository; machineRepository: IMachineRepository },
  ctx: TransactionContext,
): Promise<SignalIdsClassification> {
  const valid: Signal[] = [];
  const invalid: string[] = [];
  for (const signalId of signalIds) {
    const signal = await deps.signalRepository.findById(signalId, ctx);
    if (!signal || !signal.isActive) {
      invalid.push(signalId);
      continue;
    }
    const machine = await deps.machineRepository.findById(signal.machineId, ctx);
    if (!machine || machine.companyId !== companyId) {
      invalid.push(signalId);
      continue;
    }
    valid.push(signal);
  }
  return { valid, invalid };
}

import type { IMachineRepository } from '../seed-demo-environment/ports/machine-repository.port';
import type { ISignalRepository } from '../seed-demo-environment/ports/signal-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { SignalNotFoundForWidgetError } from './errors/signal-not-found-for-widget.error';

/**
 * docs/specs/07-dashboard-tiempo-real.md, caso borde: cada `signalId` de un widget
 * debe existir, estar activo y pertenecer a la misma Company que el Dashboard.
 */
export async function validateWidgetSignalIds(
  signalIds: string[],
  companyId: string,
  deps: { signalRepository: ISignalRepository; machineRepository: IMachineRepository },
  ctx: TransactionContext,
): Promise<void> {
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
    }
  }
  if (invalid.length > 0) {
    throw new SignalNotFoundForWidgetError(invalid);
  }
}

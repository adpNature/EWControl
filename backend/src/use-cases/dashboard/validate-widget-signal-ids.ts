import type { IMachineRepository } from '../seed-demo-environment/ports/machine-repository.port';
import type { ISignalRepository } from '../seed-demo-environment/ports/signal-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { classifySignalIdsByCompany } from '../shared/classify-signal-ids-by-company';
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
  const { invalid } = await classifySignalIdsByCompany(signalIds, companyId, deps, ctx);
  if (invalid.length > 0) {
    throw new SignalNotFoundForWidgetError(invalid);
  }
}

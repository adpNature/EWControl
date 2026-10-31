import type { PackageWidgetConfig } from '../../entities/widget-config.vo';
import type { IMachineRepository } from '../seed-demo-environment/ports/machine-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import type { IWritePackageRepository } from '../write-packages/ports/write-package-repository.port';
import { WritePackageNotFoundForWidgetError } from './errors/write-package-not-found-for-widget.error';

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, widget `PACKAGE`: la Machine debe
 * estar activa y pertenecer a la Company del Dashboard, y el paquete debe estar
 * activo y pertenecer a esa Machine. Mismo criterio que `validateWidgetSignalIds`.
 */
export async function validateWidgetPackage(
  config: PackageWidgetConfig,
  companyId: string,
  deps: { machineRepository: IMachineRepository; writePackageRepository: IWritePackageRepository },
  ctx: TransactionContext,
): Promise<void> {
  const machine = await deps.machineRepository.findById(config.machineId, ctx);
  const writePackage = await deps.writePackageRepository.findById(config.writePackageId, ctx);
  const valid =
    machine?.isActive &&
    machine.companyId === companyId &&
    writePackage?.isActive &&
    writePackage.machineId === machine.id;
  if (!valid) {
    throw new WritePackageNotFoundForWidgetError(config.writePackageId);
  }
}

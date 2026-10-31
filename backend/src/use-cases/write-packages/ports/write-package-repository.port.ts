import type { WritePackage } from '../../../entities/write-package.entity';
import type { WritePackageItem } from '../../../entities/write-package.vo';
import type { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const WRITE_PACKAGE_REPOSITORY = Symbol('WritePackageRepository');

export type WritePackageData = {
  name: string;
  description: string | null;
  items: WritePackageItem[];
};

/** docs/specs/20-paquetes-escritura-opc-ua.md: persistencia de paquetes de escritura. */
export interface IWritePackageRepository {
  create(
    data: WritePackageData & { machineId: string },
    ctx: TransactionContext,
  ): Promise<WritePackage>;
  findById(id: string, ctx: TransactionContext): Promise<WritePackage | null>;
  /** Paquete activo con ese nombre en la Machine (el nombre es único por Machine entre los activos). */
  findActiveByMachineAndName(
    machineId: string,
    name: string,
    ctx: TransactionContext,
  ): Promise<WritePackage | null>;
  listActiveByMachine(machineId: string, ctx: TransactionContext): Promise<WritePackage[]>;
  update(
    id: string,
    changes: Partial<WritePackageData>,
    ctx: TransactionContext,
  ): Promise<WritePackage>;
  deactivate(id: string, ctx: TransactionContext): Promise<void>;
}

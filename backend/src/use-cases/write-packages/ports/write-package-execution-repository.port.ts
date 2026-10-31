import type { WritePackageExecution } from '../../../entities/write-package-execution.entity';
import type { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const WRITE_PACKAGE_EXECUTION_REPOSITORY = Symbol('WritePackageExecutionRepository');

/**
 * Auditoría de ejecuciones (docs/specs/20-paquetes-escritura-opc-ua.md,
 * criterio backend 8): solo alta y lectura, sin `update` ni `delete`.
 */
export interface IWritePackageExecutionRepository {
  create(
    data: Omit<WritePackageExecution, 'id'>,
    ctx: TransactionContext,
  ): Promise<WritePackageExecution>;
  /** Más recientes primero. */
  listByPackage(
    packageId: string,
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: WritePackageExecution[]; total: number }>;
}

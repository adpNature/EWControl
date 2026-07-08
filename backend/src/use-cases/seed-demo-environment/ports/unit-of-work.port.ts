import { TransactionContext } from './transaction-context';

export const UNIT_OF_WORK = Symbol('UnitOfWork');

/**
 * Abstrae la ejecución de una operación dentro de una única transacción de base
 * de datos, sin que el use-case dependa de TypeORM (Documento 0, "Clean Architecture").
 */
export interface IUnitOfWork {
  runInTransaction<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}

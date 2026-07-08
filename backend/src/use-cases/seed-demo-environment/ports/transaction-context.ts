/**
 * Handle opaco de transacción: el use-case lo recibe de `IUnitOfWork` y lo reenvía
 * a cada repositorio sin conocer su forma real (la conoce únicamente el adaptador
 * TypeORM, que lo castea de vuelta a `EntityManager`). Así el use-case nunca importa `typeorm`.
 */
export type TransactionContext = unknown;

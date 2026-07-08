export const SCHEMA_READINESS_CHECKER = Symbol('SchemaReadinessChecker');

/**
 * Verifica que las migraciones de TypeORM ya se hayan aplicado antes de intentar
 * crear datos (spec 01-fundacion-entorno-demo.md, caso borde "migraciones no aplicadas").
 */
export interface ISchemaReadinessChecker {
  /** Resuelve si el esquema está listo; lanza `MigrationsNotAppliedError` en caso contrario. */
  ensureReady(): Promise<void>;
}

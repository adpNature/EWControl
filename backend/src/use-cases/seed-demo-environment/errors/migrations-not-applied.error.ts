/**
 * Se lanza cuando el esquema de PostgreSQL no tiene las migraciones aplicadas
 * (spec 01-fundacion-entorno-demo.md, caso borde de migraciones pendientes).
 */
export class MigrationsNotAppliedError extends Error {
  constructor() {
    super(
      'Las migraciones de la base de datos no se han aplicado. Ejecuta "pnpm run migration:run" antes de seedear.',
    );
    this.name = 'MigrationsNotAppliedError';
  }
}

import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

/**
 * Opciones de conexión a PostgreSQL compartidas por el CLI de migraciones
 * (postgres.datasource.ts), la app HTTP (app.module.ts) y el contexto de seed
 * (seed.module.ts), para no triplicar el wiring de variables de entorno.
 *
 * `namingStrategy: SnakeNamingStrategy` resuelve el mapeo snake_case (Postgres)
 * / camelCase (TypeScript) descrito en docs/04-persistencia-de-datos.md §4.2.
 */
export function postgresConnectionOptions(): Omit<
  PostgresConnectionOptions,
  'entities' | 'migrations'
> {
  return {
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
  };
}

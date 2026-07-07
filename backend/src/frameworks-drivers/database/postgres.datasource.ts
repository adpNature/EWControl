import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource de TypeORM usado por el CLI de migraciones (`npm run typeorm`/`migration:*`,
 * ver docs/04-persistencia-de-datos.md) y por AppModule en tiempo de ejecución.
 * `entities`/`migrations` apuntan a un glob: se resuelven a medida que se implementan
 * las specs correspondientes (docs/specs/), no requieren mantenimiento manual de la lista.
 */
export const postgresDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB,
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  entities: [__dirname + '/../../entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../../interface-adapters/persistence/postgres/migrations/*{.ts,.js}'],
  synchronize: false,
});

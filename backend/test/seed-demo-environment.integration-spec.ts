/**
 * Test de integración (Documento 0, "Pirámide de Testing"): arranca el módulo Nest
 * real y golpea el Postgres real de `docker compose`, sin pasar por HTTP. Requiere
 * migraciones aplicadas de antemano (`pnpm run migration:run`) — no existe
 * infraestructura de test DB separada todavía. Aísla cada test truncando las
 * tablas de fundación, no recreando el esquema.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { SignalTypeOrmRepository } from '../src/interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import {
  ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../src/use-cases/seed-demo-environment/ports/signal-repository.port';
import { TransactionContext } from '../src/use-cases/seed-demo-environment/ports/transaction-context';
import {
  PASSWORD_HASHER,
  IPasswordHasher,
} from '../src/use-cases/seed-demo-environment/ports/password-hasher.port';
import {
  SEED_COMPANY_NAME,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
} from '../src/use-cases/seed-demo-environment/seed-demo-environment.config';
import { SeedDemoEnvironmentUseCase } from '../src/use-cases/seed-demo-environment/seed-demo-environment.use-case';

async function truncateFoundationTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function countRows(dataSource: DataSource, table: string): Promise<number> {
  const rows: Array<{ count: string }> = await dataSource.query(
    `SELECT COUNT(*)::text AS count FROM "${table}"`,
  );
  return Number(rows[0].count);
}

describe('SeedDemoEnvironmentUseCase (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SeedModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
  });

  beforeEach(async () => {
    await truncateFoundationTables(dataSource);
  });

  afterAll(async () => {
    await truncateFoundationTables(dataSource);
    await app.close();
  });

  it('crea exactamente 1 Company, 1 User, 1 Machine, 1 MachineConnection y 6 Signals', async () => {
    const useCase = app.get(SeedDemoEnvironmentUseCase);

    const result = await useCase.execute();

    expect(result).toEqual({ created: true });
    expect(await countRows(dataSource, 'companies')).toBe(1);
    expect(await countRows(dataSource, 'users')).toBe(1);
    expect(await countRows(dataSource, 'machines')).toBe(1);
    expect(await countRows(dataSource, 'machine_connections')).toBe(1);
    expect(await countRows(dataSource, 'signals')).toBe(6);

    const [company] = await dataSource.query('SELECT name FROM companies');
    expect(company.name).toBe(SEED_COMPANY_NAME);
  });

  it('almacena la contraseña hasheada con bcrypt y verificable con el mismo puerto que usará el login', async () => {
    const useCase = app.get(SeedDemoEnvironmentUseCase);
    const passwordHasher = app.get<IPasswordHasher>(PASSWORD_HASHER);

    await useCase.execute();

    const [user] = await dataSource.query('SELECT email, password_hash FROM users');
    expect(user.email).toBe(SEED_USER_EMAIL);
    expect(user.password_hash).not.toBe(SEED_USER_PASSWORD);
    expect(user.password_hash).toMatch(/^\$2/);
    await expect(passwordHasher.compare(SEED_USER_PASSWORD, user.password_hash)).resolves.toBe(
      true,
    );
  });

  it('es idempotente: ejecutar el seed dos veces no duplica ninguna entidad', async () => {
    const useCase = app.get(SeedDemoEnvironmentUseCase);

    const first = await useCase.execute();
    const second = await useCase.execute();

    expect(first).toEqual({ created: true });
    expect(second).toEqual({ created: false });
    expect(await countRows(dataSource, 'companies')).toBe(1);
    expect(await countRows(dataSource, 'users')).toBe(1);
    expect(await countRows(dataSource, 'machines')).toBe(1);
    expect(await countRows(dataSource, 'machine_connections')).toBe(1);
    expect(await countRows(dataSource, 'signals')).toBe(6);
  });

  it('no deja datos parciales si una creación falla a mitad de la operación (rollback real)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [SeedModule] })
      .overrideProvider(SIGNAL_REPOSITORY)
      .useFactory({
        factory: (): ISignalRepository => {
          const real = new SignalTypeOrmRepository();
          let calls = 0;
          return {
            create: (data: Parameters<ISignalRepository['create']>[0], ctx: TransactionContext) => {
              calls += 1;
              if (calls === 3) {
                throw new Error('fallo forzado en la 3ª Signal');
              }
              return real.create(data, ctx);
            },
          };
        },
      })
      .compile();

    const failingApp = moduleRef.createNestApplication();
    await failingApp.init();
    const failingDataSource = failingApp.get<DataSource>(getDataSourceToken());
    const useCase = failingApp.get(SeedDemoEnvironmentUseCase);

    await expect(useCase.execute()).rejects.toThrow('fallo forzado en la 3ª Signal');

    expect(await countRows(failingDataSource, 'companies')).toBe(0);
    expect(await countRows(failingDataSource, 'users')).toBe(0);
    expect(await countRows(failingDataSource, 'machines')).toBe(0);
    expect(await countRows(failingDataSource, 'machine_connections')).toBe(0);
    expect(await countRows(failingDataSource, 'signals')).toBe(0);

    await failingApp.close();
  });
});

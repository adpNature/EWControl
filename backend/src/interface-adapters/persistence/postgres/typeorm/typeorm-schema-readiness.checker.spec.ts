import { describe, expect, it, vi } from 'vitest';
import { MigrationsNotAppliedError } from '../../../../use-cases/seed-demo-environment/errors/migrations-not-applied.error';
import { TypeOrmSchemaReadinessChecker } from './typeorm-schema-readiness.checker';

function createChecker(query: ReturnType<typeof vi.fn>) {
  const dataSource = { query } as unknown as import('typeorm').DataSource;
  return new TypeOrmSchemaReadinessChecker(dataSource);
}

describe('TypeOrmSchemaReadinessChecker', () => {
  it('resuelve cuando la tabla de migraciones existe y tiene registros', async () => {
    const query = vi.fn().mockResolvedValue([{ count: '3' }]);
    const checker = createChecker(query);

    await expect(checker.ensureReady()).resolves.toBeUndefined();
  });

  it('lanza MigrationsNotAppliedError cuando la tabla de migraciones está vacía', async () => {
    const query = vi.fn().mockResolvedValue([{ count: '0' }]);
    const checker = createChecker(query);

    await expect(checker.ensureReady()).rejects.toBeInstanceOf(MigrationsNotAppliedError);
  });

  it('lanza MigrationsNotAppliedError cuando la tabla de migraciones no existe (error 42P01)', async () => {
    const query = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    const checker = createChecker(query);

    await expect(checker.ensureReady()).rejects.toBeInstanceOf(MigrationsNotAppliedError);
  });

  it('propaga cualquier otro error de base de datos sin envolverlo', async () => {
    const other = Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    const query = vi.fn().mockRejectedValue(other);
    const checker = createChecker(query);

    await expect(checker.ensureReady()).rejects.toBe(other);
  });
});

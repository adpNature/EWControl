import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MigrationsNotAppliedError } from '../../../../use-cases/seed-demo-environment/errors/migrations-not-applied.error';
import { ISchemaReadinessChecker } from '../../../../use-cases/seed-demo-environment/ports/schema-readiness-checker.port';

const POSTGRES_UNDEFINED_TABLE = '42P01';

@Injectable()
export class TypeOrmSchemaReadinessChecker implements ISchemaReadinessChecker {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async ensureReady(): Promise<void> {
    let rows: Array<{ count: string }>;
    try {
      rows = await this.dataSource.query('SELECT COUNT(*)::text AS count FROM migrations');
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNDEFINED_TABLE) {
        throw new MigrationsNotAppliedError();
      }
      throw error;
    }

    if (Number(rows[0]?.count ?? 0) === 0) {
      throw new MigrationsNotAppliedError();
    }
  }
}

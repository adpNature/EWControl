import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el esquema de fundación (Documento 3, Documento 4 §4.2): Company, User,
 * Machine, MachineConnection y Signal, en orden de dependencia de claves foráneas.
 */
export class CreateFoundationSchema1783506148179 implements MigrationInterface {
  name = 'CreateFoundationSchema1783506148179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        CONSTRAINT "PK_companies" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" character varying NOT NULL,
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "FK_users_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_users_company_id" ON "users" ("company_id")');
    await queryRunner.query('CREATE INDEX "IDX_users_role" ON "users" ("role")');

    await queryRunner.query(`
      CREATE TABLE "machines" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        CONSTRAINT "PK_machines" PRIMARY KEY ("id"),
        CONSTRAINT "FK_machines_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_machines_company_id" ON "machines" ("company_id")');
    await queryRunner.query('CREATE INDEX "IDX_machines_name" ON "machines" ("name")');

    await queryRunner.query(`
      CREATE TABLE "machine_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "provider_type" character varying NOT NULL,
        "connection_config" jsonb NOT NULL,
        CONSTRAINT "PK_machine_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_machine_connections_machine_id" UNIQUE ("machine_id"),
        CONSTRAINT "FK_machine_connections_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "signals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "signal_type" character varying NOT NULL,
        "signal_source" jsonb NOT NULL,
        "unit" character varying NOT NULL,
        "history_enabled" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_signals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_signals_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_signals_machine_id" ON "signals" ("machine_id")');
    await queryRunner.query(
      'CREATE INDEX "IDX_signals_history_enabled" ON "signals" ("history_enabled")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "signals"');
    await queryRunner.query('DROP TABLE "machine_connections"');
    await queryRunner.query('DROP TABLE "machines"');
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TABLE "companies"');
  }
}

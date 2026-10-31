import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Paquetes de escritura y su auditoría (docs/specs/20-paquetes-escritura-opc-ua.md).
 * `write_packages` cuelga de su Machine y `write_package_executions` de su
 * paquete, Machine y Company, todos con `ON DELETE CASCADE` porque solo la
 * purga de una Company (spec 10) borra filas físicamente. `user_id` usa
 * `ON DELETE SET NULL`: la ejecución conserva `user_email` aunque el User se purgue.
 */
export class AddWritePackagesSchema1793404800000 implements MigrationInterface {
  name = 'AddWritePackagesSchema1793404800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "write_packages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying NULL,
        "items" jsonb NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_write_packages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_write_packages_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_write_packages_machine_id" ON "write_packages" ("machine_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "write_package_executions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "package_id" uuid NOT NULL,
        "machine_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "user_id" uuid NULL,
        "user_email" character varying NOT NULL,
        "executed_at" timestamptz NOT NULL,
        "status" character varying NOT NULL,
        "reason" character varying NULL,
        "items" jsonb NOT NULL,
        CONSTRAINT "PK_write_package_executions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_write_package_executions_package" FOREIGN KEY ("package_id") REFERENCES "write_packages"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_write_package_executions_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_write_package_executions_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_write_package_executions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_write_package_executions_package_executed" ON "write_package_executions" ("package_id", "executed_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "write_package_executions"');
    await queryRunner.query('DROP TABLE "write_packages"');
  }
}

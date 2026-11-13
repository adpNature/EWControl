import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Categorías de variables del PLC y catálogo de variables por Machine
 * (docs/specs/23-categorias-variables-plc.md). Ambas tablas cuelgan de su
 * Machine con `ON DELETE CASCADE` (solo la purga de una Company, spec 10, borra
 * Machines físicamente). Una subcategoría se borra con su padre; una entrada del
 * catálogo queda sin categoría (`SET NULL`) si se borra la suya.
 */
export class AddVariableCategoriesSchema1794528000000 implements MigrationInterface {
  name = 'AddVariableCategoriesSchema1794528000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "variable_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "parent_id" uuid NULL,
        "name" character varying(120) NOT NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_variable_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_variable_categories_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_variable_categories_parent" FOREIGN KEY ("parent_id") REFERENCES "variable_categories"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_variable_categories_machine_id" ON "variable_categories" ("machine_id")',
    );
    await queryRunner.query(`
      CREATE TABLE "variable_catalog_entries" (
        "machine_id" uuid NOT NULL,
        "node_id" character varying(1024) NOT NULL,
        "category_id" uuid NULL,
        "comment" character varying(500) NULL,
        "position" integer NOT NULL,
        CONSTRAINT "PK_variable_catalog_entries" PRIMARY KEY ("machine_id", "node_id"),
        CONSTRAINT "FK_variable_catalog_entries_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_variable_catalog_entries_category" FOREIGN KEY ("category_id") REFERENCES "variable_categories"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "variable_catalog_entries"');
    await queryRunner.query('DROP TABLE "variable_categories"');
  }
}

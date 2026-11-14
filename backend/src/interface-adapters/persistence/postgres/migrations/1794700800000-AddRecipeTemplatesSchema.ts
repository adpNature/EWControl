import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Receta base (docs/specs/26-receta-base.md): como mucho una por Machine
 * (índice único sobre `machine_id`), con `ON DELETE CASCADE` como las recetas.
 * Mientras una Machine no tiene fila, se usa la receta base por defecto.
 */
export class AddRecipeTemplatesSchema1794700800000 implements MigrationInterface {
  name = 'AddRecipeTemplatesSchema1794700800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "recipe_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "variables" jsonb NOT NULL,
        "layout" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_email" character varying NOT NULL,
        CONSTRAINT "PK_recipe_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_recipe_templates_machine_id" UNIQUE ("machine_id"),
        CONSTRAINT "FK_recipe_templates_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "recipe_templates"');
  }
}

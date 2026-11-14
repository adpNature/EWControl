import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recetas (docs/specs/25-recetas.md). Cuelgan de su Machine con
 * `ON DELETE CASCADE` (solo la purga de una Company, spec 10, borra Machines
 * físicamente). Dos índices únicos garantizan las reglas del modelo aunque
 * lleguen peticiones simultáneas: el título normalizado es único por Machine,
 * y como mucho hay una receta activa por Machine (índice parcial).
 */
export class AddRecipesSchema1794614400000 implements MigrationInterface {
  name = 'AddRecipesSchema1794614400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "recipes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "machine_id" uuid NOT NULL,
        "title" character varying(120) NOT NULL,
        "title_key" character varying(120) NOT NULL,
        "description" character varying(500) NULL,
        "search_key" text NOT NULL,
        "values" jsonb NOT NULL,
        "is_activated" boolean NOT NULL DEFAULT false,
        "activated_at" TIMESTAMP WITH TIME ZONE NULL,
        "activated_by_email" character varying NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by_email" character varying NOT NULL,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_by_email" character varying NOT NULL,
        CONSTRAINT "PK_recipes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recipes_machine" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query('CREATE INDEX "IDX_recipes_machine_id" ON "recipes" ("machine_id")');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_recipes_machine_title_key" ON "recipes" ("machine_id", "title_key")',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_recipes_machine_activated" ON "recipes" ("machine_id") WHERE "is_activated"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "recipes"');
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade la tabla de tokens de recuperación de contraseña
 * (docs/specs/10-gestion-companies-users.md): mismo esquema que
 * `refresh_tokens` (el propio `id` es el token, de un solo uso).
 */
export class AddPasswordResetSchema1784029882718 implements MigrationInterface {
  name = 'AddPasswordResetSchema1784029882718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_password_reset_tokens_user_id" ON "password_reset_tokens" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "password_reset_tokens"');
  }
}

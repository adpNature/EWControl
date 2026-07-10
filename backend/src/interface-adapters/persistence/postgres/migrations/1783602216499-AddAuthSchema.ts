import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade el esquema de autenticación (docs/specs/05-auth-login.md): estado de
 * activación de Company/User, tabla de refresh tokens (rotación con detección
 * de reuso) y tabla combinada de auditoría de acceso + rate limiting de login
 * (docs/06-seguridad-global.md, apartado 6.6).
 */
export class AddAuthSchema1783602216499 implements MigrationInterface {
  name = 'AddAuthSchema1783602216499';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "companies" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      'ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true',
    );

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "replaced_by_jti" uuid,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_refresh_tokens_user_id_status" ON "refresh_tokens" ("user_id", "status")',
    );

    await queryRunner.query(`
      CREATE TABLE "auth_audit_log" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_type" character varying NOT NULL,
        "email" character varying,
        "user_id" uuid,
        "company_id" uuid,
        "result" character varying NOT NULL,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_auth_audit_log_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_auth_audit_log_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_auth_audit_log_email_created_at" ON "auth_audit_log" ("email", "created_at")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "auth_audit_log"');
    await queryRunner.query('DROP TABLE "refresh_tokens"');
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN "is_active"');
    await queryRunner.query('ALTER TABLE "companies" DROP COLUMN "is_active"');
  }
}

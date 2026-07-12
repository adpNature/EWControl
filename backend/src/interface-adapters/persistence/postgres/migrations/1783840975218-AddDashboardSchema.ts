import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el esquema de Dashboard/DashboardWidget (docs/specs/07-dashboard-tiempo-real.md,
 * Documento 3 apartados 3.2.8/3.2.9): baja física en cascada (`ON DELETE CASCADE`),
 * a diferencia de Machine/Signal — un Dashboard es pura configuración de presentación
 * sin histórico que preservar.
 */
export class AddDashboardSchema1783840975218 implements MigrationInterface {
  name = 'AddDashboardSchema1783840975218';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dashboards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        CONSTRAINT "PK_dashboards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dashboards_company" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_dashboards_company_id" ON "dashboards" ("company_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "dashboard_widgets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "dashboard_id" uuid NOT NULL,
        "widget_type" character varying NOT NULL,
        "widget_config" jsonb NOT NULL,
        "position" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_dashboard_widgets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_dashboard_widgets_dashboard" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_dashboard_widgets_dashboard_id" ON "dashboard_widgets" ("dashboard_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "dashboard_widget_signals" (
        "dashboard_widget_id" uuid NOT NULL,
        "signal_id" uuid NOT NULL,
        CONSTRAINT "PK_dashboard_widget_signals" PRIMARY KEY ("dashboard_widget_id", "signal_id"),
        CONSTRAINT "FK_dashboard_widget_signals_widget" FOREIGN KEY ("dashboard_widget_id") REFERENCES "dashboard_widgets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dashboard_widget_signals_signal" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "dashboard_widget_signals"');
    await queryRunner.query('DROP TABLE "dashboard_widgets"');
    await queryRunner.query('DROP TABLE "dashboards"');
  }
}

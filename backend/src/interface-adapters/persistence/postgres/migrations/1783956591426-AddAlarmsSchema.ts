import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea el esquema de AlarmDefinition/AlarmState (docs/specs/09-alarmas.md,
 * Documento 3 apartados 3.2.6/3.2.7). `signal_id` se denormaliza en
 * `alarm_states` (además de derivarse de `alarm_definition_id`) para poder
 * filtrar/joinear por Machine en `GET /alarm-states` en un solo hop. Sin
 * columna "puntero al estado vigente": la fila vigente de una AlarmDefinition
 * es la de `activated_at` más reciente (mismo criterio que `RefreshToken.status`).
 * Baja física en cascada (`ON DELETE CASCADE`) igual que Dashboard — referencial,
 * en la práctica no se espera que dispare porque Signal solo tiene baja lógica.
 */
export class AddAlarmsSchema1783956591426 implements MigrationInterface {
  name = 'AddAlarmsSchema1783956591426';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "alarm_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "signal_id" uuid NOT NULL,
        "operator" character varying(2) NOT NULL,
        "threshold" jsonb NOT NULL,
        "priority" character varying NOT NULL,
        "notify_by_email" boolean NOT NULL DEFAULT false,
        "show_on_dashboard" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_alarm_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_alarm_definitions_signal" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_alarm_definitions_signal_id" ON "alarm_definitions" ("signal_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "alarm_states" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "alarm_definition_id" uuid NOT NULL,
        "signal_id" uuid NOT NULL,
        "status" character varying NOT NULL,
        "priority" character varying NOT NULL,
        "activated_at" timestamptz NOT NULL,
        "resolved_at" timestamptz NULL,
        CONSTRAINT "PK_alarm_states" PRIMARY KEY ("id"),
        CONSTRAINT "FK_alarm_states_alarm_definition" FOREIGN KEY ("alarm_definition_id") REFERENCES "alarm_definitions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_alarm_states_signal" FOREIGN KEY ("signal_id") REFERENCES "signals"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_alarm_states_alarm_definition_id_activated_at" ON "alarm_states" ("alarm_definition_id", "activated_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_alarm_states_signal_id" ON "alarm_states" ("signal_id")',
    );
    await queryRunner.query('CREATE INDEX "IDX_alarm_states_status" ON "alarm_states" ("status")');
    await queryRunner.query(
      'CREATE INDEX "IDX_alarm_states_priority" ON "alarm_states" ("priority")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "alarm_states"');
    await queryRunner.query('DROP TABLE "alarm_definitions"');
  }
}

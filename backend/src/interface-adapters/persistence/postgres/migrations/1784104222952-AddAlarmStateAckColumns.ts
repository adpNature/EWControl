import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade el reconocimiento manual de alarmas (ACK, docs/specs/11-ack-alarmas.md)
 * a `alarm_states`: quién la reconoció y cuándo. `ON DELETE SET NULL` en
 * `acked_by_user_id` porque un User puede darse de baja/purgarse (spec 10)
 * sin que deba perderse el AlarmState; `acked_by_email` queda denormalizado
 * igualmente, para no depender de esa referencia al mostrarlo.
 */
export class AddAlarmStateAckColumns1784104222952 implements MigrationInterface {
  name = 'AddAlarmStateAckColumns1784104222952';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "alarm_states"
      ADD COLUMN "acked_at" timestamptz NULL,
      ADD COLUMN "acked_by_user_id" uuid NULL,
      ADD COLUMN "acked_by_email" character varying NULL,
      ADD CONSTRAINT "FK_alarm_states_acked_by_user" FOREIGN KEY ("acked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "alarm_states"
      DROP CONSTRAINT "FK_alarm_states_acked_by_user",
      DROP COLUMN "acked_by_email",
      DROP COLUMN "acked_by_user_id",
      DROP COLUMN "acked_at"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Añade el estado de activación de Machine/Signal (docs/specs/06-gestion-machines-signals.md):
 * soporta la baja lógica de una Machine con desactivación en cascada de sus Signals
 * (Documento 3, apartado 3.2.3), mismo patrón que Company/User (AddAuthSchema).
 */
export class AddMachineSignalSoftDelete1783679618908 implements MigrationInterface {
  name = 'AddMachineSignalSoftDelete1783679618908';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "machines" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query(
      'ALTER TABLE "signals" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query('CREATE INDEX "IDX_machines_is_active" ON "machines" ("is_active")');
    await queryRunner.query('CREATE INDEX "IDX_signals_is_active" ON "signals" ("is_active")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_signals_is_active"');
    await queryRunner.query('DROP INDEX "IDX_machines_is_active"');
    await queryRunner.query('ALTER TABLE "signals" DROP COLUMN "is_active"');
    await queryRunner.query('ALTER TABLE "machines" DROP COLUMN "is_active"');
  }
}

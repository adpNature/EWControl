import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { WritePackageExecutionStatus } from './write-package-execution-status.enum';
import type { WriteValue } from './write-package.vo';

/** Resultado de un elemento del paquete: el `StatusCode` OPC UA, o `NOT_SENT` si no llegó a enviarse. */
export type WritePackageExecutionItem = {
  signalVariableName: string;
  nodeId: string | null;
  value: WriteValue;
  statusCode: string;
};

/**
 * Registro de auditoría de una ejecución de paquete (docs/specs/20-paquetes-escritura-opc-ua.md,
 * criterio backend 8): quién, cuándo, qué valores y con qué resultado. Inmutable,
 * sin `update` ni `delete` en su repositorio. `userEmail` va denormalizado para
 * no depender del User si se da de baja o se purga. `reason` explica una
 * ejecución rechazada antes de escribir (`WRITE_PACKAGE_OUTDATED`,
 * `MACHINE_NOT_CONNECTED`, `WRITE_IN_PROGRESS`, `PROVIDER_NOT_SUPPORTED`) o un `TIMEOUT`.
 */
@Entity('write_package_executions')
@Index(['packageId', 'executedAt'])
export class WritePackageExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  packageId: string;

  @Column()
  machineId: string;

  @Column()
  companyId: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  userEmail: string;

  @Column({ type: 'timestamptz' })
  executedAt: Date;

  @Column({ type: 'varchar' })
  status: WritePackageExecutionStatus;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb' })
  items: WritePackageExecutionItem[];
}

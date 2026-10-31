import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Machine } from './machine.entity';
import type { WritePackageItem } from './write-package.vo';

/**
 * Paquete de escritura (docs/specs/20-paquetes-escritura-opc-ua.md): receta
 * cerrada con valores fijos que se escriben juntos en el PLC de una Machine.
 * Pertenece a una Machine y hereda su Company. Baja lógica (`isActive`), para
 * que su historial de ejecuciones siga apuntando a un paquete existente.
 */
@Entity('write_packages')
@Index(['machineId'])
export class WritePackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  machineId: string;

  @ManyToOne(() => Machine)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  items: WritePackageItem[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}

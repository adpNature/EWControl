import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Machine } from './machine.entity';

/**
 * Categoría de variables del PLC de una Machine
 * (docs/specs/23-categorias-variables-plc.md). Dos niveles: las raíz tienen
 * `parentId = null` y sus hijas apuntan a ellas. Se crean importando la
 * exportación CSV de la GVL y solo se renombran.
 */
@Entity('variable_categories')
@Index(['machineId'])
export class VariableCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  machineId: string;

  @ManyToOne(() => Machine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Orden de aparición en el CSV. */
  @Column({ type: 'int' })
  position: number;
}

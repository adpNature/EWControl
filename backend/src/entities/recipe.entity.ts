import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Machine } from './machine.entity';
import type { RecipeValueEntry } from './recipe.vo';

/**
 * Receta (docs/specs/25-recetas.md): plantilla con un título y un valor para
 * cada variable de la categoría «Programación para la receta» de una Machine.
 * Solo vive en PostgreSQL: no se escribe en el PLC ni en InfluxDB, y se borra
 * físicamente. `isActivated` es una marca sin efecto (como mucho una por Machine).
 */
@Entity('recipes')
@Index(['machineId'])
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  machineId: string;

  @ManyToOne(() => Machine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  /** Título normalizado (sin mayúsculas ni tildes): clave de unicidad por Machine. */
  @Column({ type: 'varchar', length: 120, select: false })
  titleKey: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Título y descripción normalizados, para el buscador. */
  @Column({ type: 'text', select: false })
  searchKey: string;

  @Column({ type: 'jsonb' })
  values: RecipeValueEntry[];

  @Column({ default: false })
  isActivated: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  activatedByEmail: string | null;

  /** Sube en cada edición del contenido, para detectar ediciones simultáneas. */
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'varchar' })
  createdByEmail: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @Column({ type: 'varchar' })
  updatedByEmail: string;
}

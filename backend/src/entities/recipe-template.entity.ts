import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Machine } from './machine.entity';
import type { RecipeLayout, RecipeVariableConfig } from './recipe-template.vo';

/**
 * Receta base de una Machine (docs/specs/26-receta-base.md): configuración de
 * cada variable de receta y disposición del formulario de recetas. Como mucho
 * una por Machine; sin fila, se usa la receta base por defecto (no se guarda).
 */
@Entity('recipe_templates')
export class RecipeTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Única (`UQ_recipe_templates_machine_id`, en la migración): una receta base por Machine. */
  @Column()
  machineId: string;

  @ManyToOne(() => Machine, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column({ type: 'jsonb' })
  variables: RecipeVariableConfig[];

  @Column({ type: 'jsonb' })
  layout: RecipeLayout;

  /** Sube en cada guardado, para detectar ediciones simultáneas. La por defecto es la 0. */
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @Column({ type: 'varchar' })
  updatedByEmail: string;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Variable del PLC tal como figura en la exportación de la GVL
 * (docs/specs/23-categorias-variables-plc.md): su categoría y su descripción.
 * Se identifica por el `nodeId` con el que la expone el servidor OPC UA, así
 * que sirve tanto para variables ya mapeadas como para las que aún no lo están.
 */
@Entity('variable_catalog_entries')
export class VariableCatalogEntry {
  @PrimaryColumn('uuid')
  machineId: string;

  @PrimaryColumn({ type: 'varchar', length: 1024 })
  nodeId: string;

  /** Subcategoría o categoría; `null` si la variable va antes del primer título del CSV. */
  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  /** Descripción libre del CSV (comentario sin marco). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  comment: string | null;

  /** Orden de aparición en el CSV. */
  @Column({ type: 'int' })
  position: number;
}

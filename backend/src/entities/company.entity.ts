import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Aggregate Root del contexto organizativo (Documento 3, apartado 3.2.1).
 * Solo los campos que necesita la spec 01: campos de desactivación/auditoría
 * se añaden cuando la spec que los necesite exista.
 */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}

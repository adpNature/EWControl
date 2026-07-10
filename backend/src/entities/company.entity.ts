import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Aggregate Root del contexto organizativo (Documento 3, apartado 3.2.1).
 */
@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** Una Company dada de baja impide el login/refresh de todos sus Users (docs/specs/05-auth-login.md). */
  @Column({ default: true })
  isActive: boolean;
}

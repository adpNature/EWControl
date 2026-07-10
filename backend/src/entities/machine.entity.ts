import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Company } from './company.entity';

/**
 * Aggregate Root del dominio industrial (Documento 3, apartado 3.2.3).
 */
@Entity('machines')
@Index(['companyId', 'name'])
export class Machine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column()
  name: string;

  /** Una Machine dada de baja desactiva en cascada todas sus Signals (Documento 3, apartado 3.2.3). */
  @Column({ default: true })
  isActive: boolean;
}

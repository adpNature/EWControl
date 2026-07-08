import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Company } from './company.entity';
import { UserRole } from './user-role.enum';

/**
 * Identidad funcional de una persona dentro de una Company (Documento 3, apartado 3.2.2).
 */
@Entity('users')
@Index(['companyId'])
@Index(['role'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'varchar' })
  role: UserRole;
}

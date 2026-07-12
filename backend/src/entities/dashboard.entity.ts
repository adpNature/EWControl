import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { DashboardWidget } from './dashboard-widget.entity';

/**
 * Configuración de presentación (Documento 3, apartado 3.2.8): agrupa
 * DashboardWidgets, sin lógica de negocio propia. Baja física (no lógica):
 * a diferencia de Machine/Signal, no hay histórico que preservar al borrarlo.
 */
@Entity('dashboards')
@Index(['companyId'])
export class Dashboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  companyId: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @Column()
  name: string;

  @OneToMany(() => DashboardWidget, (widget) => widget.dashboard)
  widgets: DashboardWidget[];
}

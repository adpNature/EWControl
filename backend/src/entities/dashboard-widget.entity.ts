import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';
import { Signal } from './signal.entity';
import type { WidgetConfig } from './widget-config.vo';
import { WidgetType } from './widget-type.enum';

/**
 * Elemento visual de un Dashboard (Documento 3, apartado 3.2.9): referencia una
 * o varias Signals, nunca Variables. Baja física, igual que su Dashboard.
 */
@Entity('dashboard_widgets')
@Index(['dashboardId'])
export class DashboardWidget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  dashboardId: string;

  @ManyToOne(() => Dashboard)
  @JoinColumn({ name: 'dashboard_id' })
  dashboard: Dashboard;

  @Column({ type: 'varchar' })
  widgetType: WidgetType;

  @Column({ type: 'jsonb' })
  widgetConfig: WidgetConfig;

  @Column({ default: 0 })
  position: number;

  @ManyToMany(() => Signal)
  @JoinTable({
    name: 'dashboard_widget_signals',
    joinColumn: { name: 'dashboard_widget_id' },
    inverseJoinColumn: { name: 'signal_id' },
  })
  signals: Signal[];
}

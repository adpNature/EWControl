import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AlarmPriority } from './alarm-priority.enum';
import type { AlarmOperator } from './alarm-operator.vo';
import { Signal } from './signal.entity';

/**
 * Regla de supervisión configurada por el usuario sobre una Signal (Documento 3,
 * apartado 3.2.6). No evalúa nada por sí misma — eso es responsabilidad del
 * Alarm Engine (`entities/alarm-engine.ts`).
 */
@Entity('alarm_definitions')
@Index(['signalId'])
export class AlarmDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  signalId: string;

  @ManyToOne(() => Signal)
  @JoinColumn({ name: 'signal_id' })
  signal: Signal;

  @Column({ type: 'varchar', length: 2 })
  operator: AlarmOperator;

  @Column({ type: 'jsonb' })
  threshold: number | boolean | string;

  @Column({ type: 'varchar' })
  priority: AlarmPriority;

  @Column({ default: false })
  notifyByEmail: boolean;

  @Column({ default: true })
  showOnDashboard: boolean;

  /** Desactivada por `DELETE .../alarm-definitions/:id` (baja lógica, nunca física: preserva el histórico de AlarmState). */
  @Column({ default: true })
  isActive: boolean;
}

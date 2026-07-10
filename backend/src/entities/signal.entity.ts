import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Machine } from './machine.entity';
import type { SignalSource } from './signal-source.vo';
import { SignalType } from './signal-type.enum';

/**
 * Objeto central del dominio (Documento 3, apartado 3.2.5): unidad de
 * información de negocio sobre la que se construyen históricos, alarmas y dashboards.
 */
@Entity('signals')
@Index(['machineId', 'historyEnabled'])
export class Signal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  machineId: string;

  @ManyToOne(() => Machine)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column()
  name: string;

  @Column({ type: 'varchar' })
  signalType: SignalType;

  @Column({ type: 'jsonb' })
  signalSource: SignalSource;

  @Column()
  unit: string;

  @Column({ default: false })
  historyEnabled: boolean;

  /** Se desactiva individualmente o en cascada al desactivarse su Machine (docs/specs/06-gestion-machines-signals.md). */
  @Column({ default: true })
  isActive: boolean;
}

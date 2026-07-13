import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AlarmDefinition } from './alarm-definition.entity';
import { AlarmPriority } from './alarm-priority.enum';
import { AlarmStateType } from './alarm-state-type.enum';
import { Signal } from './signal.entity';

/**
 * Resultado de evaluar una AlarmDefinition (Documento 3, apartado 3.2.7): su
 * estado actual y su historial de activaciones. Solo el Alarm Engine puede
 * crearlo/modificarlo — no existen endpoints de escritura (docs/11-api-rest.md).
 *
 * Sin columna "puntero al estado vigente" (mismo criterio que `RefreshToken.status`):
 * la fila vigente de una AlarmDefinition es la de `activatedAt` más reciente.
 * `signalId` se denormaliza (además de derivarse de `alarmDefinitionId`) para
 * poder filtrar/joinear por Machine en una sola consulta (`GET /alarm-states`).
 */
@Entity('alarm_states')
@Index(['alarmDefinitionId', 'activatedAt'])
@Index(['signalId'])
@Index(['status'])
@Index(['priority'])
export class AlarmState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  alarmDefinitionId: string;

  @ManyToOne(() => AlarmDefinition)
  @JoinColumn({ name: 'alarm_definition_id' })
  alarmDefinition: AlarmDefinition;

  @Column()
  signalId: string;

  @ManyToOne(() => Signal)
  @JoinColumn({ name: 'signal_id' })
  signal: Signal;

  @Column({ type: 'varchar' })
  status: AlarmStateType;

  /** Copia de `AlarmDefinition.priority` en el momento de activar, para no depender de un join al listar/filtrar. */
  @Column({ type: 'varchar' })
  priority: AlarmPriority;

  @Column({ type: 'timestamptz' })
  activatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}

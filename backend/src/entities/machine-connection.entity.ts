import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { ConnectionConfig } from './connection-config.vo';
import { Machine } from './machine.entity';
import { ProviderType } from './provider-type.enum';

/**
 * Frontera entre el dominio y la infraestructura de adquisición de datos
 * (Documento 3, apartado 3.2.4). Almacena configuración, nunca estado.
 */
@Entity('machine_connections')
export class MachineConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  machineId: string;

  @OneToOne(() => Machine)
  @JoinColumn({ name: 'machine_id' })
  machine: Machine;

  @Column({ type: 'varchar' })
  providerType: ProviderType;

  @Column({ type: 'jsonb' })
  connectionConfig: ConnectionConfig;
}

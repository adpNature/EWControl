import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * Token de recuperación de contraseña de un solo uso (docs/specs/10-gestion-companies-users.md).
 * `id` es el propio token (generado con `IIdGenerator`, nunca `new Date()`/`Math.random()`
 * inline); `usedAt` marca cuándo se consumió, en vez de borrar la fila, para
 * conservar rastro de auditoría igual que el resto del esquema de auth.
 */
@Entity('password_reset_tokens')
@Index(['userId'])
export class PasswordResetToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

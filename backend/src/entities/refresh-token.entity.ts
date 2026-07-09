import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RefreshTokenStatus } from './refresh-token-status.enum';
import { User } from './user.entity';

/**
 * Puntero de estado de un refresh token JWT (docs/specs/05-auth-login.md).
 * `id` es el `jti` embebido en el JWT firmado con `JWT_REFRESH_SECRET`; esta fila
 * nunca almacena el secreto, solo si sigue vigente, fue rotado o fue revocado —
 * la autenticidad del token la garantiza su firma, no esta tabla.
 */
@Entity('refresh_tokens')
@Index(['userId', 'status'])
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', default: RefreshTokenStatus.Active })
  status: RefreshTokenStatus;

  @Column({ type: 'uuid', nullable: true })
  replacedByJti: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

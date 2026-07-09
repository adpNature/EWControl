import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuthAuditEventType } from './auth-audit-event-type.enum';
import { AuthAuditResult } from './auth-audit-result.enum';

/**
 * Auditoría de acceso (docs/06-seguridad-global.md, apartado 6.6) y, a la vez,
 * fuente del rate limiting de login (docs/specs/05-auth-login.md, criterio 7):
 * ambos necesitan lo mismo (email, resultado, fecha), así que se cubren con
 * una sola escritura por intento en vez de dos mecanismos independientes.
 */
@Entity('auth_audit_log')
@Index(['email', 'createdAt'])
export class AuthAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  eventType: AuthAuditEventType;

  /**
   * Nullable: en `refresh`/`logout` un fallo de verificación de firma no permite
   * conocer el usuario ni su email; solo `login` lo garantiza siempre (input directo
   * del usuario), que es también el único flujo que necesita este campo para el
   * rate limiting (criterio de aceptación 7).
   */
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', nullable: true })
  companyId: string | null;

  @Column({ type: 'varchar' })
  result: AuthAuditResult;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'timestamptz' })
  createdAt: Date;
}

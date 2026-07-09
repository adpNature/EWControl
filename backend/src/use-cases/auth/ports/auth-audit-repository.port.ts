import { AuthAuditEventType } from '../../../entities/auth-audit-event-type.enum';
import { AuthAuditResult } from '../../../entities/auth-audit-result.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const AUTH_AUDIT_REPOSITORY = Symbol('AuthAuditRepository');

export type AuthAuditEntry = {
  eventType: AuthAuditEventType;
  email: string | null;
  userId: string | null;
  companyId: string | null;
  result: AuthAuditResult;
  metadata?: Record<string, unknown>;
  /** Provisto por el caller vía `IClock`, nunca `new Date()` en el adaptador (determinismo en tests). */
  createdAt: Date;
};

/**
 * Auditoría de acceso (docs/06-seguridad-global.md, 6.6) que también respalda
 * el rate limiting de login (docs/specs/05-auth-login.md, criterio 7).
 */
export interface IAuthAuditRepository {
  record(entry: AuthAuditEntry, ctx: TransactionContext): Promise<void>;
  countRecentFailures(email: string, since: Date, ctx: TransactionContext): Promise<number>;
}

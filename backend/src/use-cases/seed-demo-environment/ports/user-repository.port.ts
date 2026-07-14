import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../entities/user-role.enum';
import { TransactionContext } from './transaction-context';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface IUserRepository {
  create(
    data: { companyId: string; email: string; passwordHash: string; role: UserRole },
    ctx: TransactionContext,
  ): Promise<User>;
  /** docs/specs/09-alarmas.md: destinatarios del email de notificación de una alarma. */
  findActiveByCompanyAndRole(
    companyId: string,
    role: UserRole,
    ctx: TransactionContext,
  ): Promise<User[]>;
  /** docs/specs/10-gestion-companies-users.md. */
  findById(id: string, ctx: TransactionContext): Promise<User | null>;
  /** El email de User es único en toda la plataforma, no solo por Company. */
  findByEmail(email: string, ctx: TransactionContext): Promise<User | null>;
  list(
    filter: { companyId: string | null; isActive: boolean },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: User[]; total: number }>;
  update(
    id: string,
    changes: { email?: string; role?: UserRole },
    ctx: TransactionContext,
  ): Promise<User>;
  deactivate(id: string, ctx: TransactionContext): Promise<User>;
}

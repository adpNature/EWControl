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
  /**
   * docs/specs/10-gestion-companies-users.md: lista TODOS los Users (activos
   * e inactivos), a diferencia del filtro previo — necesario para poder
   * verlos y reactivarlos.
   */
  list(
    filter: { companyId: string | null },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: User[]; total: number }>;
  update(
    id: string,
    changes: { email?: string; role?: UserRole },
    ctx: TransactionContext,
  ): Promise<User>;
  deactivate(id: string, ctx: TransactionContext): Promise<User>;
  reactivate(id: string, ctx: TransactionContext): Promise<User>;
  /** Borrado físico (docs/specs/10-gestion-companies-users.md, "purge" de Company). */
  deleteAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<void>;
}

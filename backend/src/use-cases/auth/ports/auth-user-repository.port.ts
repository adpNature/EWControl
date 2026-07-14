import { UserRole } from '../../../entities/user-role.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const AUTH_USER_REPOSITORY = Symbol('AuthUserRepository');

/** Proyección de User+Company que necesita Auth, sin acoplar el use-case a las entidades TypeORM. */
export type AuthUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  companyIsActive: boolean;
};

export interface IAuthUserRepository {
  findByEmailWithCompany(email: string, ctx: TransactionContext): Promise<AuthUserRecord | null>;
  findByIdWithCompany(userId: string, ctx: TransactionContext): Promise<AuthUserRecord | null>;
  /** docs/specs/10-gestion-companies-users.md: cambio propio y recuperación de contraseña. */
  updatePasswordHash(userId: string, passwordHash: string, ctx: TransactionContext): Promise<void>;
}

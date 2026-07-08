import { User } from '../../../entities/user.entity';
import { UserRole } from '../../../entities/user-role.enum';
import { TransactionContext } from './transaction-context';

export const USER_REPOSITORY = Symbol('UserRepository');

export interface IUserRepository {
  create(
    data: { companyId: string; email: string; passwordHash: string; role: UserRole },
    ctx: TransactionContext,
  ): Promise<User>;
}

import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { UserNotFoundError } from './errors/user-not-found.error';

export type Requester = { companyId: string; role: UserRole };

/**
 * Centraliza el aislamiento multiempresa de User (docs/06-seguridad-global.md, 6.7),
 * mismo patrón que `MachineAccessResolver`: un recurso inexistente, de otra
 * Company, o inactivo responde siempre 404 (UserNotFoundError), nunca 403.
 * Solo un SuperAdmin cruza el límite de Company.
 */
@Injectable()
export class UserAccessResolver {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async resolveAny(userId: string, requester: Requester, ctx: TransactionContext): Promise<User> {
    const user = await this.userRepository.findById(userId, ctx);
    if (!user || !this.belongsToRequester(user, requester)) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }

  async resolveActive(
    userId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<User> {
    const user = await this.resolveAny(userId, requester, ctx);
    if (!user.isActive) {
      throw new UserNotFoundError(userId);
    }
    return user;
  }

  private belongsToRequester(user: User, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || user.companyId === requester.companyId;
  }
}

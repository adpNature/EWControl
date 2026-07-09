import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../../../entities/user.entity';
import { UserRole } from '../../../../entities/user-role.enum';
import {
  AuthUserRecord,
  IAuthUserRepository,
} from '../../../../use-cases/auth/ports/auth-user-repository.port';
import { IUserRepository } from '../../../../use-cases/seed-demo-environment/ports/user-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class UserTypeOrmRepository implements IUserRepository, IAuthUserRepository {
  create(
    data: { companyId: string; email: string; passwordHash: string; role: UserRole },
    ctx: TransactionContext,
  ): Promise<User> {
    const repository = (ctx as EntityManager).getRepository(User);
    return repository.save(repository.create(data));
  }

  async findByEmailWithCompany(
    email: string,
    ctx: TransactionContext,
  ): Promise<AuthUserRecord | null> {
    const user = await (ctx as EntityManager)
      .getRepository(User)
      .findOne({ where: { email }, relations: ['company'] });
    return user ? this.toAuthUserRecord(user) : null;
  }

  async findByIdWithCompany(
    userId: string,
    ctx: TransactionContext,
  ): Promise<AuthUserRecord | null> {
    const user = await (ctx as EntityManager)
      .getRepository(User)
      .findOne({ where: { id: userId }, relations: ['company'] });
    return user ? this.toAuthUserRecord(user) : null;
  }

  private toAuthUserRecord(user: User): AuthUserRecord {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      companyIsActive: user.company.isActive,
    };
  }
}

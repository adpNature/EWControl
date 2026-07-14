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

  findActiveByCompanyAndRole(
    companyId: string,
    role: UserRole,
    ctx: TransactionContext,
  ): Promise<User[]> {
    return (ctx as EntityManager)
      .getRepository(User)
      .find({ where: { companyId, role, isActive: true } });
  }

  findById(id: string, ctx: TransactionContext): Promise<User | null> {
    return (ctx as EntityManager).getRepository(User).findOne({ where: { id } });
  }

  findByEmail(email: string, ctx: TransactionContext): Promise<User | null> {
    return (ctx as EntityManager).getRepository(User).findOne({ where: { email } });
  }

  async list(
    filter: { companyId: string | null },
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: User[]; total: number }> {
    const repository = (ctx as EntityManager).getRepository(User);
    const where = filter.companyId ? { companyId: filter.companyId } : {};
    const [data, total] = await repository.findAndCount({
      where,
      take: pagination.limit,
      skip: pagination.offset,
      order: { email: 'ASC' },
    });
    return { data, total };
  }

  async update(
    id: string,
    changes: { email?: string; role?: UserRole },
    ctx: TransactionContext,
  ): Promise<User> {
    const repository = (ctx as EntityManager).getRepository(User);
    await repository.update(id, changes);
    return repository.findOneByOrFail({ id });
  }

  async deactivate(id: string, ctx: TransactionContext): Promise<User> {
    const repository = (ctx as EntityManager).getRepository(User);
    await repository.update(id, { isActive: false });
    return repository.findOneByOrFail({ id });
  }

  async reactivate(id: string, ctx: TransactionContext): Promise<User> {
    const repository = (ctx as EntityManager).getRepository(User);
    await repository.update(id, { isActive: true });
    return repository.findOneByOrFail({ id });
  }

  async deleteAllByCompanyId(companyId: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(User).delete({ companyId });
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

  async updatePasswordHash(
    userId: string,
    passwordHash: string,
    ctx: TransactionContext,
  ): Promise<void> {
    await (ctx as EntityManager).getRepository(User).update(userId, { passwordHash });
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

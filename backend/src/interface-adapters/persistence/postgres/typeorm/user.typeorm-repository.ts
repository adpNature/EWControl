import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../../../entities/user.entity';
import { UserRole } from '../../../../entities/user-role.enum';
import { IUserRepository } from '../../../../use-cases/seed-demo-environment/ports/user-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class UserTypeOrmRepository implements IUserRepository {
  create(
    data: { companyId: string; email: string; passwordHash: string; role: UserRole },
    ctx: TransactionContext,
  ): Promise<User> {
    const repository = (ctx as EntityManager).getRepository(User);
    return repository.save(repository.create(data));
  }
}

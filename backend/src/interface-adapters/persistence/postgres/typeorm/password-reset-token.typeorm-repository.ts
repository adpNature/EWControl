import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PasswordResetToken } from '../../../../entities/password-reset-token.entity';
import {
  IPasswordResetTokenRepository,
  PasswordResetTokenRecord,
} from '../../../../use-cases/auth/ports/password-reset-token-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class PasswordResetTokenTypeOrmRepository implements IPasswordResetTokenRepository {
  async create(
    data: { id: string; userId: string; expiresAt: Date; createdAt: Date },
    ctx: TransactionContext,
  ): Promise<void> {
    const repository = (ctx as EntityManager).getRepository(PasswordResetToken);
    await repository.save(repository.create({ ...data, usedAt: null }));
  }

  async findById(id: string, ctx: TransactionContext): Promise<PasswordResetTokenRecord | null> {
    const record = await (ctx as EntityManager)
      .getRepository(PasswordResetToken)
      .findOne({ where: { id } });
    return record
      ? { id: record.id, userId: record.userId, expiresAt: record.expiresAt, usedAt: record.usedAt }
      : null;
  }

  async markUsed(id: string, usedAt: Date, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(PasswordResetToken).update({ id }, { usedAt });
  }
}

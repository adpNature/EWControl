import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RefreshToken } from '../../../../entities/refresh-token.entity';
import { RefreshTokenStatus } from '../../../../entities/refresh-token-status.enum';
import {
  IRefreshTokenRepository,
  RefreshTokenRecord,
} from '../../../../use-cases/auth/ports/refresh-token-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class RefreshTokenTypeOrmRepository implements IRefreshTokenRepository {
  async create(
    data: { id: string; userId: string; expiresAt: Date; createdAt: Date },
    ctx: TransactionContext,
  ): Promise<void> {
    const repository = (ctx as EntityManager).getRepository(RefreshToken);
    await repository.save(repository.create({ ...data, status: RefreshTokenStatus.Active }));
  }

  async findById(id: string, ctx: TransactionContext): Promise<RefreshTokenRecord | null> {
    const record = await (ctx as EntityManager).getRepository(RefreshToken).findOne({
      where: { id },
    });
    return record
      ? { id: record.id, userId: record.userId, status: record.status, expiresAt: record.expiresAt }
      : null;
  }

  async markRotated(id: string, replacedByJti: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager)
      .getRepository(RefreshToken)
      .update({ id }, { status: RefreshTokenStatus.Rotated, replacedByJti });
  }

  async revokeById(id: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager)
      .getRepository(RefreshToken)
      .update({ id }, { status: RefreshTokenStatus.Revoked });
  }

  async revokeAllActiveForUser(userId: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager)
      .getRepository(RefreshToken)
      .update(
        { userId, status: RefreshTokenStatus.Active },
        { status: RefreshTokenStatus.Revoked },
      );
  }
}

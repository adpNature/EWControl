import { Injectable } from '@nestjs/common';
import { EntityManager, MoreThanOrEqual } from 'typeorm';
import { AuthAuditLog } from '../../../../entities/auth-audit-log.entity';
import { AuthAuditEventType } from '../../../../entities/auth-audit-event-type.enum';
import {
  AuthAuditEntry,
  IAuthAuditRepository,
} from '../../../../use-cases/auth/ports/auth-audit-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class AuthAuditLogTypeOrmRepository implements IAuthAuditRepository {
  async record(entry: AuthAuditEntry, ctx: TransactionContext): Promise<void> {
    const repository = (ctx as EntityManager).getRepository(AuthAuditLog);
    await repository.save(repository.create(entry));
  }

  countRecentFailures(email: string, since: Date, ctx: TransactionContext): Promise<number> {
    return (ctx as EntityManager).getRepository(AuthAuditLog).count({
      where: {
        email,
        eventType: AuthAuditEventType.LoginFailure,
        createdAt: MoreThanOrEqual(since),
      },
    });
  }
}

import { RefreshTokenStatus } from '../../../entities/refresh-token-status.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  status: RefreshTokenStatus;
  expiresAt: Date;
};

/**
 * Puntero de estado de los refresh tokens (docs/specs/05-auth-login.md).
 * El JWT en sí nunca se persiste; `id` es su `jti`.
 */
export interface IRefreshTokenRepository {
  create(
    data: { id: string; userId: string; expiresAt: Date; createdAt: Date },
    ctx: TransactionContext,
  ): Promise<void>;
  findById(id: string, ctx: TransactionContext): Promise<RefreshTokenRecord | null>;
  markRotated(id: string, replacedByJti: string, ctx: TransactionContext): Promise<void>;
  revokeById(id: string, ctx: TransactionContext): Promise<void>;
  revokeAllActiveForUser(userId: string, ctx: TransactionContext): Promise<void>;
}

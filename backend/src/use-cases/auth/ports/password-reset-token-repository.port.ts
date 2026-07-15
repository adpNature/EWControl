import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PasswordResetTokenRepository');

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

/**
 * Token de recuperación de contraseña de un solo uso (docs/specs/10-gestion-companies-users.md),
 * mismo patrón que `IRefreshTokenRepository`: el propio `id` es el token, nunca se persiste ningún otro secreto.
 */
export interface IPasswordResetTokenRepository {
  create(
    data: { id: string; userId: string; expiresAt: Date; createdAt: Date },
    ctx: TransactionContext,
  ): Promise<void>;
  findById(id: string, ctx: TransactionContext): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string, usedAt: Date, ctx: TransactionContext): Promise<void>;
}

import { UserRole } from '../../entities/user-role.enum';

/** Resultado común de `login`/`refresh` (docs/specs/05-auth-login.md). */
export type AuthSessionResult = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: { id: string; email: string; role: UserRole; companyId: string };
};

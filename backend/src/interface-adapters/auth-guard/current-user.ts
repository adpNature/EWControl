import { UserRole } from '../../entities/user-role.enum';

/** Se cuelga en `req.user` tras verificar el access token (docs/specs/05-auth-login.md). */
export type CurrentUser = {
  id: string;
  email: string;
  companyId: string;
  role: UserRole;
};

import { UserRole } from '../../../entities/user-role.enum';

export const TOKEN_SERVICE = Symbol('TokenService');

/**
 * Incluye `email` porque el Frontend decodifica este payload (sin verificar
 * firma, solo lectura) para repintar `currentUser` tras un refresh silencioso
 * al recargar la página (docs/specs/05-auth-login.md, criterio frontend 4) —
 * necesita los mismos campos que ya devuelve el body de `/auth/login`.
 */
export type AccessTokenPayload = {
  sub: string;
  email: string;
  companyId: string;
  role: UserRole;
};

export type RefreshTokenPayload = {
  sub: string;
  companyId: string;
  role: UserRole;
  jti: string;
};

export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  signRefreshToken(payload: RefreshTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}

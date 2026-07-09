import { User, UserRole } from '../entities/user.model';

interface AccessTokenClaims {
  sub: string;
  email: string;
  companyId: string;
  role: UserRole;
}

/**
 * Decodifica el payload de un access token JWT **sin verificar su firma** —
 * solo para repintar `currentUser` tras un refresh silencioso al recargar la
 * página (docs/specs/05-auth-login.md, criterio frontend 4). La verificación
 * de la firma es responsabilidad exclusiva del Backend en cada petición; este
 * valor nunca se usa para tomar decisiones de autorización en el Frontend.
 */
export function decodeAccessToken(accessToken: string): User | null {
  const [, payloadSegment] = accessToken.split('.');
  if (!payloadSegment) {
    return null;
  }

  try {
    const claims = JSON.parse(base64UrlDecode(payloadSegment)) as AccessTokenClaims;
    return { id: claims.sub, email: claims.email, companyId: claims.companyId, role: claims.role };
  } catch {
    return null;
  }
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return atob(padded);
}

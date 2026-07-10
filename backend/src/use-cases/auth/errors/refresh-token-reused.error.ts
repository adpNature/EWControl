/**
 * Se detectó la reutilización de un refresh token ya rotado (indicio de robo):
 * el caller debe haber invalidado ya todas las sesiones activas del usuario
 * (docs/specs/05-auth-login.md, criterio backend 4; docs/06-seguridad-global.md 6.2).
 */
export class RefreshTokenReusedError extends Error {
  constructor() {
    super('El refresh token ya fue utilizado; se han invalidado todas las sesiones.');
    this.name = 'RefreshTokenReusedError';
  }
}

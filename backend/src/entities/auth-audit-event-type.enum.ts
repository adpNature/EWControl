export enum AuthAuditEventType {
  LoginSuccess = 'LOGIN_SUCCESS',
  LoginFailure = 'LOGIN_FAILURE',
  LoginBlocked = 'LOGIN_BLOCKED',
  RefreshSuccess = 'REFRESH_SUCCESS',
  RefreshFailure = 'REFRESH_FAILURE',
  RefreshReuseDetected = 'REFRESH_REUSE_DETECTED',
  Logout = 'LOGOUT',
  /** docs/specs/10-gestion-companies-users.md: auto-servicio de contraseña. */
  PasswordChange = 'PASSWORD_CHANGE',
  PasswordResetRequested = 'PASSWORD_RESET_REQUESTED',
  PasswordResetSuccess = 'PASSWORD_RESET_SUCCESS',
}

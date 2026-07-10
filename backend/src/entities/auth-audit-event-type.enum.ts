export enum AuthAuditEventType {
  LoginSuccess = 'LOGIN_SUCCESS',
  LoginFailure = 'LOGIN_FAILURE',
  LoginBlocked = 'LOGIN_BLOCKED',
  RefreshSuccess = 'REFRESH_SUCCESS',
  RefreshFailure = 'REFRESH_FAILURE',
  RefreshReuseDetected = 'REFRESH_REUSE_DETECTED',
  Logout = 'LOGOUT',
}

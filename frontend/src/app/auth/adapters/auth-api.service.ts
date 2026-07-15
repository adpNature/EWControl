import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { LoginCredentials, LoginResponse, RefreshResponse } from '../entities/auth-session.model';

/** Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección Auth. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', credentials);
  }

  refresh(): Observable<RefreshResponse> {
    return this.api.post<RefreshResponse>('/auth/refresh', {});
  }

  logout(): Observable<void> {
    return this.api.post<void>('/auth/logout', {});
  }

  /** docs/specs/10-gestion-companies-users.md, sección Auto-servicio de contraseña. */
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.api.patch<void>('/users/me/password', { currentPassword, newPassword });
  }

  /** docs/specs/10-gestion-companies-users.md, recuperación de contraseña. */
  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.post<void>('/auth/reset-password', { token, newPassword });
  }
}

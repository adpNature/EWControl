import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { AuthApiService } from '../adapters/auth-api.service';
import { User } from '../entities/user.model';
import { decodeAccessToken } from './decode-access-token';

/**
 * Use Case transversal de sesión (docs/08-frontend-dashboard.md, apartado 8.2):
 * único lugar del Frontend con el estado de autenticación — el resto de
 * features futuras lo consumen inyectándolo directamente desde `auth/`, sin
 * duplicarlo en `core/state/` (ver plan de docs/specs/05-auth-login.md).
 * El `accessToken` vive únicamente en memoria (nunca `localStorage`/`sessionStorage`,
 * criterio de aceptación frontend 2, OWASP A03).
 */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly authApi = inject(AuthApiService);

  private readonly currentUserSignal = signal<User | null>(null);
  private readonly accessTokenSignal = signal<string | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  /**
   * Single-flight: si ya hay un `refresh` en curso, cualquier llamada adicional
   * (ej. varias peticiones que reciben 401 a la vez, ver `authInterceptor`)
   * recibe el mismo resultado en vez de disparar una llamada HTTP por cada una.
   */
  private refreshInFlight: Observable<string> | null = null;

  login(email: string, password: string): Observable<User> {
    return this.authApi.login({ email, password }).pipe(
      tap((response) => {
        this.accessTokenSignal.set(response.accessToken);
        this.currentUserSignal.set(response.user);
      }),
      map((response) => response.user),
    );
  }

  logout(): Observable<void> {
    return this.authApi.logout().pipe(finalize(() => this.clearSession()));
  }

  refresh(): Observable<string> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const request = this.authApi.refresh().pipe(
      map((response) => response.accessToken),
      tap((accessToken) => this.applyAccessToken(accessToken)),
      catchError((error: unknown) => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.refreshInFlight = request;
    return request;
  }

  /**
   * Refresh silencioso al arrancar la app (`provideAppInitializer`, criterio de
   * aceptación frontend 4): nunca rechaza, para no bloquear el arranque si no
   * hay cookie de sesión o el Backend no responde.
   */
  async initializeSession(): Promise<void> {
    try {
      await firstValueFrom(this.refresh());
    } catch {
      // Sin sesión previa o refresh token inválido/caducado: se continúa sin sesión.
    }
  }

  clearSession(): void {
    this.currentUserSignal.set(null);
    this.accessTokenSignal.set(null);
  }

  private applyAccessToken(accessToken: string): void {
    this.accessTokenSignal.set(accessToken);
    this.currentUserSignal.set(decodeAccessToken(accessToken));
  }
}

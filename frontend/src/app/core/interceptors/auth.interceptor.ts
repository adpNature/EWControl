import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStateService } from '../../auth/use-cases/auth.state';

const API_PREFIX = '/api/v1';
const AUTH_ENDPOINT_PATTERN = /\/auth\/(login|refresh|logout|forgot-password|reset-password)$/;

/**
 * docs/specs/05-auth-login.md, criterio de aceptación frontend 3. Adjunta el
 * `accessToken` en memoria a toda petición a la API; si responde `401`, intenta
 * un único refresh automático y reintenta la petición original una vez. Nunca
 * dispara ese refresh sobre los propios endpoints de `/auth/*` (evita el loop
 * de un login con credenciales inválidas o el propio refresh disparándose a
 * sí mismo); `authState.refresh()` ya limpia la sesión si el refresh falla,
 * este interceptor solo se encarga de redirigir a `/login`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  if (!req.url.startsWith(API_PREFIX)) {
    return next(req);
  }

  return next(withAuthHeader(req, authState.accessToken())).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!isUnauthorized || AUTH_ENDPOINT_PATTERN.test(req.url)) {
        return throwError(() => error);
      }

      return authState.refresh().pipe(
        switchMap((newAccessToken) => next(withAuthHeader(req, newAccessToken))),
        catchError((refreshError: unknown) => {
          router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function withAuthHeader(
  req: HttpRequest<unknown>,
  accessToken: string | null,
): HttpRequest<unknown> {
  if (!accessToken) {
    return req;
  }
  // Clave entre comillas: es el nombre literal de la cabecera HTTP, no un
  // identificador de código (evita el naming-convention camelCase de ESLint).
  return req.clone({ setHeaders: { ['Authorization']: `Bearer ${accessToken}` } });
}

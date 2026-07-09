import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../../auth/use-cases/auth.state';

/**
 * docs/specs/05-auth-login.md, criterio de aceptación frontend 1. La sesión ya
 * queda resuelta antes de la primera navegación por el refresh silencioso de
 * `provideAppInitializer` (`app.config.ts`), así que este guard solo lee el
 * signal, sin disparar peticiones HTTP propias.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return authState.isAuthenticated()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

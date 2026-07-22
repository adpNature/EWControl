import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../../auth/use-cases/auth.state';

/**
 * docs/specs/17-landing-page.md, criterio de aceptación frontend 2: un `User`
 * ya autenticado que navega a `/` no debe ver la landing, sino ir directo a
 * `/dashboard`. Inverso de `authGuard` (`core/guards/auth.guard.ts`).
 */
export const redirectIfAuthenticatedGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return authState.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

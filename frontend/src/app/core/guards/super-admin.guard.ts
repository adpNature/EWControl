import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../../auth/use-cases/auth.state';

/**
 * docs/specs/10-gestion-companies-users.md, criterio de aceptación frontend 1:
 * la pantalla de Companies solo es accesible para `SuperAdmin`. El Backend
 * rechaza igualmente con `403` si se solicita directamente (`RolesGuard`).
 */
export const superAdminGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return authState.currentUser()?.role === 'SuperAdmin' ? true : router.createUrlTree(['/config']);
};

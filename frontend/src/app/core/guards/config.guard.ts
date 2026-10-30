import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../../auth/use-cases/auth.state';
import { canAccessConfig } from '../../config/use-cases/config-permissions';

/**
 * docs/specs/19-rol-operador.md, criterio de aceptación frontend 3: todo
 * `/config/**` queda fuera del alcance del `Operador`, que vuelve al Dashboard
 * sin llegar a cargar la página. El Backend rechaza igualmente con `403`
 * cualquier operación de configuración (`RolesGuard`).
 */
export const configGuard: CanActivateFn = () => {
  const authState = inject(AuthStateService);
  const router = inject(Router);

  return canAccessConfig(authState.currentUser()?.role)
    ? true
    : router.createUrlTree(['/dashboard']);
};

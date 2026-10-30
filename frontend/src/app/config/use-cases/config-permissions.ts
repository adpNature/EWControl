import { UserRole } from '../../auth/entities/user.model';

const CONFIG_ROLES: readonly UserRole[] = ['AdminCliente', 'SuperAdmin'];

/**
 * docs/08-frontend-dashboard.md, apartado 8.6, Regla 1: solo `AdminCliente` y
 * `SuperAdmin` configuran (Machines, Signals, reglas de alarma, Dashboards);
 * el `Operador` (docs/specs/19-rol-operador.md) queda excluido. El Backend
 * sigue siendo la autoridad final (Regla 2, `RolesGuard`); esta función nunca
 * sustituye su validación, solo oculta lo que el rol no puede hacer.
 */
export function canConfigure(role: UserRole | undefined): boolean {
  return !!role && CONFIG_ROLES.includes(role);
}

/**
 * docs/specs/10-gestion-companies-users.md, Documento 8 apartado 8.6: a
 * diferencia de Machine/Signal, la gestión de Companies es la única fila de
 * esa tabla restringida a `SuperAdmin` — el alta de un cliente es una
 * operación de plataforma, no de la Company del propio usuario.
 */
export function canManageCompanies(role: UserRole | undefined): boolean {
  return role === 'SuperAdmin';
}

/**
 * docs/specs/10-gestion-companies-users.md: gestión de Users, mismos roles que
 * `canConfigure()` (AdminCliente en su propia Company, SuperAdmin en cualquiera).
 */
export function canManageUsers(role: UserRole | undefined): boolean {
  return !!role && CONFIG_ROLES.includes(role);
}

/**
 * docs/specs/19-rol-operador.md, criterios de aceptación frontend 2 y 3: si la
 * sección "Configuración" (todo `/config/**`) es accesible para el rol.
 */
export function canAccessConfig(role: UserRole | undefined): boolean {
  return canConfigure(role);
}

import { UserRole } from '../../auth/entities/user.model';

const CONFIG_ROLES: readonly UserRole[] = ['AdminCliente', 'SuperAdmin'];

/**
 * docs/08-frontend-dashboard.md, apartado 8.6, Regla 1: hoy ambos roles tienen
 * acceso a la gestión de Machines/Signals — no hay ningún rol excluido
 * todavía, así que esto solo deja la regla preparada para ocultar acciones en
 * cuanto exista un rol sin permiso. El Backend sigue siendo la autoridad
 * final (Regla 2); esta función nunca sustituye su validación.
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

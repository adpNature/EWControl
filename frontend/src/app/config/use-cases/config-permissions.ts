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

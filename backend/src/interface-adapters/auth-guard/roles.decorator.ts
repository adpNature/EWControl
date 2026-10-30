import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../entities/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Restringe un endpoint a los roles indicados, leído por `RolesGuard`
 * (docs/specs/10-gestion-companies-users.md). camelCase, misma razón que
 * `publicRoute()`. Sin este decorador, `RolesGuard` deja pasar cualquier rol
 * autenticado (comportamiento por defecto documentado en
 * `current-user.decorator.ts`).
 */
export const roles = (...allowed: UserRole[]) => SetMetadata(ROLES_KEY, allowed);

/**
 * docs/specs/19-rol-operador.md: roles que pueden configurar (Machines,
 * Signals, conexiones, reglas de alarma, Dashboards, Users, Simulador). El
 * `Operador` queda fuera: cualquier ruta con `@roles(...CONFIGURATION_ROLES)`
 * le responde `403`.
 */
export const CONFIGURATION_ROLES: readonly UserRole[] = [
  UserRole.SuperAdmin,
  UserRole.AdminCliente,
];

/** Los tres roles: para rutas abiertas a todos dentro de un controller restringido. */
export const ALL_ROLES: readonly UserRole[] = [
  UserRole.SuperAdmin,
  UserRole.AdminCliente,
  UserRole.Operador,
];

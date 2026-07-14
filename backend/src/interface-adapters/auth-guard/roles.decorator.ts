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

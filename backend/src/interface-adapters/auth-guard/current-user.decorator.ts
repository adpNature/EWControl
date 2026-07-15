import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from './current-user';

/**
 * Extrae el usuario colgado en `request.user` por el `JwtAuthGuard` (docs/specs/05-auth-login.md).
 * camelCase (no `CurrentUser` en PascalCase) por la misma regla de naming del
 * proyecto que ya renombró `Public()` a `publicRoute()`.
 *
 * Los endpoints que excluyen un rol concreto (p. ej. `CompanyController`, solo
 * `SuperAdmin`) usan `RolesGuard`/`roles()` (docs/specs/10-gestion-companies-users.md),
 * no este decorador.
 */
export const currentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    return request.user;
  },
);

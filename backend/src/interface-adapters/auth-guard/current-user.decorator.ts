import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from './current-user';

/**
 * Extrae el usuario colgado en `request.user` por el `JwtAuthGuard` (docs/specs/05-auth-login.md).
 * camelCase (no `CurrentUser` en PascalCase) por la misma regla de naming del
 * proyecto que ya renombró `Public()` a `publicRoute()`.
 *
 * No existe todavía un `RolesGuard`: los dos roles definidos (`SuperAdmin`,
 * `AdminCliente`) tienen acceso a la gestión de Machines/Signals
 * (docs/specs/06-gestion-machines-signals.md) — la próxima spec que excluya un
 * rol de una funcionalidad concreta debe añadir el guard de roles, no aquí.
 */
export const currentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    return request.user;
  },
);

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '../../entities/user-role.enum';
import { CurrentUser } from './current-user';
import { ROLES_KEY } from './roles.decorator';

/**
 * Guard global (registrado como segundo `APP_GUARD` en `auth.module.ts`, tras
 * `JwtAuthGuard`): rechaza con `403` cualquier endpoint marcado con `@roles(...)`
 * si el rol del `CurrentUser` ya poblado por `JwtAuthGuard` no está en la lista
 * (docs/specs/10-gestion-companies-users.md). Sin `@roles(...)` deja pasar
 * cualquier rol autenticado, igual que hasta ahora.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: CurrentUser }>();
    if (!allowedRoles.includes(request.user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para acceder a este recurso.',
      });
    }
    return true;
  }
}

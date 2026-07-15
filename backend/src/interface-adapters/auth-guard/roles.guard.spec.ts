import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { RolesGuard } from './roles.guard';

function buildContext(role: UserRole | undefined): ExecutionContext {
  const request = {
    user: role ? { id: 'user-1', email: 'a@b.com', companyId: 'company-1', role } : undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows the request when no roles metadata is declared', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext(UserRole.AdminCliente))).toBe(true);
  });

  it('allows the request when the user role is included in the declared roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.SuperAdmin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(buildContext(UserRole.SuperAdmin))).toBe(true);
  });

  it('throws ForbiddenException when the user role is not included in the declared roles', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.SuperAdmin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext(UserRole.AdminCliente))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException with a stable error code', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.SuperAdmin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    try {
      guard.canActivate(buildContext(UserRole.AdminCliente));
      expect.unreachable();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual({
        code: 'FORBIDDEN',
        message: 'No tiene permiso para acceder a este recurso.',
      });
    }
  });
});

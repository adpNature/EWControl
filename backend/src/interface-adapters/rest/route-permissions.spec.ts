import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { IS_PUBLIC_KEY } from '../auth-guard/public.decorator';
import { ROLES_KEY } from '../auth-guard/roles.decorator';

/**
 * docs/specs/19-rol-operador.md, criterio backend 3 y "Seguridad" (A04): la
 * matriz de permisos se verifica leyendo los metadatos de **todos** los
 * controllers, no una lista de rutas escrita a mano. Una ruta nueva sin
 * `@roles(...)` queda abierta a cualquier rol autenticado (comportamiento por
 * defecto de `RolesGuard`), así que este test falla hasta que se decida
 * explícitamente si el `Operador` puede usarla.
 */

type Route = { key: string; allowed: UserRole[] | 'any' };

/** Rutas que un `Operador` SÍ puede usar (matriz de la spec 19). Todo lo demás debe excluirle. */
const OPERADOR_ALLOWED = new Set([
  'POST auth/login',
  'POST auth/refresh',
  'POST auth/forgot-password',
  'POST auth/reset-password',
  'POST auth/logout',
  'GET health/live',
  'GET health/ready',
  'GET metrics',
  'GET dashboards',
  'GET dashboards/:id',
  'GET machines',
  'GET machines/:id',
  'GET machines/:machineId/signals',
  'GET machines/:machineId/signals/:id',
  'GET machines/:machineId/signals/:id/value',
  'GET machines/:machineId/signals/:id/history',
  'GET signals/history',
  'GET signals/:signalId/alarm-definitions',
  'GET alarm-states',
  'GET alarm-states/:id',
  'POST alarm-states/:id/ack',
  'PATCH users/me/password',
  // docs/specs/20-paquetes-escritura-opc-ua.md: el Operador consulta y ejecuta paquetes, no los gestiona.
  'GET machines/:machineId/write-packages',
  'GET machines/:machineId/write-packages/:id',
  'POST machines/:machineId/write-packages/:id/execute',
  'GET machines/:machineId/write-packages/:id/executions',
]);

const controllerModules = (
  import.meta as unknown as {
    glob: (pattern: string, options: { eager: true }) => Record<string, Record<string, unknown>>;
  }
).glob('./**/*.controller.ts', { eager: true });

function joinPath(base: string, sub: string): string {
  return [base, sub]
    .map((part) => part.replace(/^\/+|\/+$/g, ''))
    .filter((part) => part.length > 0)
    .join('/');
}

function collectRoutes(): Route[] {
  const routes: Route[] = [];
  for (const exported of Object.values(controllerModules).flatMap((m) => Object.values(m))) {
    if (typeof exported !== 'function') {
      continue;
    }
    const basePath = Reflect.getMetadata(PATH_METADATA, exported) as string | undefined;
    if (basePath === undefined) {
      continue;
    }
    const prototype = exported.prototype as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[name];
      if (typeof handler !== 'function' || name === 'constructor') {
        continue;
      }
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
      const subPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (method === undefined || subPath === undefined) {
        continue;
      }
      const isPublic =
        Reflect.getMetadata(IS_PUBLIC_KEY, handler) ?? Reflect.getMetadata(IS_PUBLIC_KEY, exported);
      // Misma precedencia que RolesGuard (getAllAndOverride): método antes que clase.
      const roles = (Reflect.getMetadata(ROLES_KEY, handler) ??
        Reflect.getMetadata(ROLES_KEY, exported)) as UserRole[] | undefined;
      routes.push({
        key: `${RequestMethod[method]} ${joinPath(basePath, subPath)}`,
        allowed: isPublic || !roles || roles.length === 0 ? 'any' : roles,
      });
    }
  }
  return routes;
}

function allows(route: Route, role: UserRole): boolean {
  return route.allowed === 'any' || route.allowed.includes(role);
}

describe('Matriz de permisos por rol (docs/specs/19-rol-operador.md)', () => {
  const routes = collectRoutes();

  it('descubre las rutas de todos los controllers', () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(routes.map((r) => r.key)).toContain('PATCH users/me/password');
  });

  it('el Operador solo puede usar las rutas de la matriz; cualquier otra le devuelve 403 (criterio 3)', () => {
    const wronglyAllowed = routes
      .filter((route) => allows(route, UserRole.Operador) && !OPERADOR_ALLOWED.has(route.key))
      .map((route) => route.key);
    const wronglyDenied = routes
      .filter((route) => !allows(route, UserRole.Operador) && OPERADOR_ALLOWED.has(route.key))
      .map((route) => route.key);

    expect(wronglyAllowed).toEqual([]);
    expect(wronglyDenied).toEqual([]);
  });

  it('todas las rutas de la matriz existen (la lista no tiene entradas obsoletas)', () => {
    const keys = new Set(routes.map((route) => route.key));
    expect([...OPERADOR_ALLOWED].filter((key) => !keys.has(key))).toEqual([]);
  });

  it('AdminCliente y SuperAdmin conservan acceso a todo salvo Companies, que es solo SuperAdmin (criterio 7)', () => {
    const deniedToAdmin = routes
      .filter((route) => !allows(route, UserRole.AdminCliente))
      .map((route) => route.key);
    const deniedToSuperAdmin = routes
      .filter((route) => !allows(route, UserRole.SuperAdmin))
      .map((route) => route.key);

    expect(deniedToSuperAdmin).toEqual([]);
    expect(deniedToAdmin.every((key) => key.split(' ')[1].startsWith('companies'))).toBe(true);
    expect(deniedToAdmin.length).toBeGreaterThan(0);
  });
});

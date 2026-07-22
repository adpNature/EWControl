import { authGuard } from './core/guards/auth.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';
import { routes } from './app.routes';

describe('routes', () => {
  it('monta la landing pública en la raíz exacta ("/"), con redirectIfAuthenticatedGuard', () => {
    const landingRoute = routes.find((route) => route.path === '' && !route.children);

    expect(landingRoute).toBeTruthy();
    expect(landingRoute?.pathMatch).toBe('full');
    expect(landingRoute?.canActivate).toEqual([redirectIfAuthenticatedGuard]);
  });

  it('mantiene login/forgot-password/reset-password como rutas públicas top-level, fuera del shell', () => {
    const publicPaths = routes.map((route) => route.path);

    expect(publicPaths).toContain('login');
    expect(publicPaths).toContain('forgot-password');
    expect(publicPaths).toContain('reset-password');
  });

  it('monta un único shell privado con authGuard, que agrupa dashboard/config/alarms/cuenta', () => {
    const shellRoute = routes.find((route) => route.path === '' && route.children);

    expect(shellRoute).toBeTruthy();
    expect(shellRoute?.canActivate).toEqual([authGuard]);

    const childPaths = shellRoute?.children?.map((child) => child.path);
    expect(childPaths).toEqual(
      expect.arrayContaining([
        'dashboard',
        'config',
        'alarms',
        'history',
        'account/change-password',
      ]),
    );
  });

  it('no repite authGuard en las rutas hijas del shell (vive una sola vez en el padre)', () => {
    const shellRoute = routes.find((route) => route.path === '' && route.children);

    for (const child of shellRoute?.children ?? []) {
      expect(child.canActivate).toBeUndefined();
    }
  });

  it('sigue redirigiendo rutas desconocidas a dashboard', () => {
    const wildcard = routes.find((route) => route.path === '**');
    expect(wildcard?.redirectTo).toBe('dashboard');
  });
});

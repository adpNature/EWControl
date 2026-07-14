import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes) },
  {
    // docs/specs/10-gestion-companies-users.md, decisión de diseño 9: top-level
    // (no hijas de `login`) para evitar URLs anidadas raras (`/login/forgot-password`).
    path: 'forgot-password',
    loadComponent: () =>
      import('./auth/pages/forgot-password-page/forgot-password-page').then(
        (m) => m.ForgotPasswordPage,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/pages/reset-password-page/reset-password-page').then(
        (m) => m.ResetPasswordPage,
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    // Placeholder hasta que exista la spec real de Dashboard (docs/specs/05-auth-login.md).
    loadComponent: () =>
      import('./dashboard/pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'config',
    canActivate: [authGuard],
    loadChildren: () => import('./config/config.routes').then((m) => m.configRoutes),
  },
  {
    path: 'alarms',
    canActivate: [authGuard],
    loadChildren: () => import('./alarms/alarms.routes').then((m) => m.alarmsRoutes),
  },
  {
    // docs/specs/10-gestion-companies-users.md: top-level porque auth.routes.ts
    // no lleva guard propio (todo lo que cuelga de `login` es público por diseño).
    path: 'account/change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/pages/change-password-page/change-password-page').then(
        (m) => m.ChangePasswordPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];

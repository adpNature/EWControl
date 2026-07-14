import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadChildren: () => import('./auth/auth.routes').then((m) => m.authRoutes) },
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
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];

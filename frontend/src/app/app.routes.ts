import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './core/guards/auth.guard';
import { redirectIfAuthenticatedGuard } from './core/guards/redirect-if-authenticated.guard';
import { BreadcrumbCrumb } from './shared/ui/breadcrumb/breadcrumb.model';
import { configGuard } from './core/guards/config.guard';

/** docs/specs/12-navegacion-shell.md: el breadcrumb se muestra en toda la zona privada. */
const dashboardBreadcrumb: BreadcrumbCrumb[] = [{ label: 'Dashboard' }];
const changePasswordBreadcrumb: BreadcrumbCrumb[] = [{ label: 'Cuenta' }];
const writePackagesBreadcrumb: BreadcrumbCrumb[] = [{ label: 'Paquetes' }];

export const routes: Routes = [
  {
    // docs/specs/17-landing-page.md: landing pública de bienvenida. `pathMatch:
    // 'full'` para que solo intercepte la URL raíz exacta; el resto de rutas
    // (`/dashboard`, `/config/*`...) siguen cayendo en el shell guardado de abajo.
    path: '',
    pathMatch: 'full',
    canActivate: [redirectIfAuthenticatedGuard],
    loadComponent: () =>
      import('./marketing/pages/landing-page/landing-page').then((m) => m.LandingPage),
  },
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
    // docs/specs/12-navegacion-shell.md: shell de la zona privada (sidebar +
    // breadcrumb). El guard vive una única vez aquí, no repetido por hija.
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        data: { breadcrumb: dashboardBreadcrumb },
        loadComponent: () =>
          import('./dashboard/pages/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'config',
        canActivate: [configGuard],
        loadChildren: () => import('./config/config.routes').then((m) => m.configRoutes),
      },
      {
        path: 'alarms',
        loadChildren: () => import('./alarms/alarms.routes').then((m) => m.alarmsRoutes),
      },
      {
        path: 'history',
        loadChildren: () => import('./history/history.routes').then((m) => m.historyRoutes),
      },
      {
        // docs/specs/20-paquetes-escritura-opc-ua.md: ejecutar paquetes es de los
        // tres roles (incluido el Operador), así que vive fuera de `config`.
        path: 'paquetes',
        data: { breadcrumb: writePackagesBreadcrumb },
        loadComponent: () =>
          import('./write-packages/pages/write-packages-page/write-packages-page').then(
            (m) => m.WritePackagesPage,
          ),
      },
      {
        // docs/specs/10-gestion-companies-users.md: top-level porque auth.routes.ts
        // no lleva guard propio (todo lo que cuelga de `login` es público por diseño).
        path: 'account/change-password',
        data: { breadcrumb: changePasswordBreadcrumb },
        loadComponent: () =>
          import('./auth/pages/change-password-page/change-password-page').then(
            (m) => m.ChangePasswordPage,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];

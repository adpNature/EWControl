import { Routes } from '@angular/router';
import { superAdminGuard } from '../core/guards/super-admin.guard';

/**
 * docs/specs/06-gestion-machines-signals.md: rutas de gestión de Machines/Signals.
 * docs/specs/10-gestion-companies-users.md añade `companies` (solo SuperAdmin,
 * `superAdminGuard`) y `users` (sin guard adicional, ambos roles entran).
 */
export const configRoutes: Routes = [
  {
    path: 'companies',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/company-list-page/company-list-page').then((m) => m.CompanyListPage),
  },
  {
    path: 'companies/new',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/company-form-page/company-form-page').then((m) => m.CompanyFormPage),
  },
  {
    path: 'companies/:companyId/edit',
    canActivate: [superAdminGuard],
    loadComponent: () =>
      import('./pages/company-form-page/company-form-page').then((m) => m.CompanyFormPage),
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./pages/user-list-page/user-list-page').then((m) => m.UserListPage),
  },
  {
    path: 'users/new',
    loadComponent: () =>
      import('./pages/user-form-page/user-form-page').then((m) => m.UserFormPage),
  },
  {
    path: 'users/:userId/edit',
    loadComponent: () =>
      import('./pages/user-form-page/user-form-page').then((m) => m.UserFormPage),
  },
  {
    path: 'machines',
    loadComponent: () =>
      import('./pages/machine-list-page/machine-list-page').then((m) => m.MachineListPage),
  },
  {
    path: 'machines/new',
    loadComponent: () =>
      import('./pages/machine-form-page/machine-form-page').then((m) => m.MachineFormPage),
  },
  {
    path: 'machines/:machineId',
    loadComponent: () =>
      import('./pages/machine-detail-page/machine-detail-page').then((m) => m.MachineDetailPage),
  },
  {
    path: 'machines/:machineId/edit',
    loadComponent: () =>
      import('./pages/machine-form-page/machine-form-page').then((m) => m.MachineFormPage),
  },
  {
    path: 'machines/:machineId/signals/new',
    loadComponent: () =>
      import('./pages/signal-form-page/signal-form-page').then((m) => m.SignalFormPage),
  },
  {
    path: 'machines/:machineId/signals/:signalId/edit',
    loadComponent: () =>
      import('./pages/signal-form-page/signal-form-page').then((m) => m.SignalFormPage),
  },
  {
    path: 'machines/:machineId/signals/:signalId/alarm-definitions/new',
    loadComponent: () =>
      import('../alarms/pages/alarm-definition-form-page/alarm-definition-form-page').then(
        (m) => m.AlarmDefinitionFormPage,
      ),
  },
  {
    path: 'machines/:machineId/signals/:signalId/alarm-definitions/:alarmDefinitionId/edit',
    loadComponent: () =>
      import('../alarms/pages/alarm-definition-form-page/alarm-definition-form-page').then(
        (m) => m.AlarmDefinitionFormPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'machines' },
];

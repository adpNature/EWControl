import { Routes } from '@angular/router';
import { superAdminGuard } from '../core/guards/super-admin.guard';
import {
  alarmDefinitionFormEditBreadcrumb,
  alarmDefinitionFormNewBreadcrumb,
  companiesListBreadcrumb,
  companyFormEditBreadcrumb,
  companyFormNewBreadcrumb,
  machineConnectionBreadcrumb,
  machineDetailBreadcrumb,
  machineFormEditBreadcrumb,
  machineFormNewBreadcrumb,
  machinesListBreadcrumb,
  signalFormEditBreadcrumb,
  signalFormNewBreadcrumb,
  userFormEditBreadcrumb,
  userFormNewBreadcrumb,
  usersListBreadcrumb,
  writePackageFormEditBreadcrumb,
  writePackageFormNewBreadcrumb,
} from './use-cases/config-breadcrumbs';

/**
 * docs/specs/06-gestion-machines-signals.md: rutas de gestión de Machines/Signals.
 * docs/specs/10-gestion-companies-users.md añade `companies` (solo SuperAdmin,
 * `superAdminGuard`) y `users` (sin guard adicional, ambos roles entran).
 * docs/specs/18-integracion-opc-ua.md añade `machines/:machineId/connection`.
 * docs/specs/20-paquetes-escritura-opc-ua.md añade el alta/edición de paquetes de escritura.
 */
export const configRoutes: Routes = [
  {
    path: 'companies',
    canActivate: [superAdminGuard],
    data: { breadcrumb: companiesListBreadcrumb },
    loadComponent: () =>
      import('./pages/company-list-page/company-list-page').then((m) => m.CompanyListPage),
  },
  {
    path: 'companies/new',
    canActivate: [superAdminGuard],
    data: { breadcrumb: companyFormNewBreadcrumb },
    loadComponent: () =>
      import('./pages/company-form-page/company-form-page').then((m) => m.CompanyFormPage),
  },
  {
    path: 'companies/:companyId/edit',
    canActivate: [superAdminGuard],
    data: { breadcrumb: companyFormEditBreadcrumb },
    loadComponent: () =>
      import('./pages/company-form-page/company-form-page').then((m) => m.CompanyFormPage),
  },
  {
    path: 'users',
    data: { breadcrumb: usersListBreadcrumb },
    loadComponent: () =>
      import('./pages/user-list-page/user-list-page').then((m) => m.UserListPage),
  },
  {
    path: 'users/new',
    data: { breadcrumb: userFormNewBreadcrumb },
    loadComponent: () =>
      import('./pages/user-form-page/user-form-page').then((m) => m.UserFormPage),
  },
  {
    path: 'users/:userId/edit',
    data: { breadcrumb: userFormEditBreadcrumb },
    loadComponent: () =>
      import('./pages/user-form-page/user-form-page').then((m) => m.UserFormPage),
  },
  {
    path: 'machines',
    data: { breadcrumb: machinesListBreadcrumb },
    loadComponent: () =>
      import('./pages/machine-list-page/machine-list-page').then((m) => m.MachineListPage),
  },
  {
    path: 'machines/new',
    data: { breadcrumb: machineFormNewBreadcrumb },
    loadComponent: () =>
      import('./pages/machine-form-page/machine-form-page').then((m) => m.MachineFormPage),
  },
  {
    path: 'machines/:machineId',
    data: { breadcrumb: machineDetailBreadcrumb },
    loadComponent: () =>
      import('./pages/machine-detail-page/machine-detail-page').then((m) => m.MachineDetailPage),
  },
  {
    path: 'machines/:machineId/edit',
    data: { breadcrumb: machineFormEditBreadcrumb },
    loadComponent: () =>
      import('./pages/machine-form-page/machine-form-page').then((m) => m.MachineFormPage),
  },
  {
    path: 'machines/:machineId/connection',
    data: { breadcrumb: machineConnectionBreadcrumb },
    loadComponent: () =>
      import('./pages/machine-connection-page/machine-connection-page').then(
        (m) => m.MachineConnectionPage,
      ),
  },
  {
    path: 'machines/:machineId/write-packages/new',
    data: { breadcrumb: writePackageFormNewBreadcrumb },
    loadComponent: () =>
      import('./pages/write-package-form-page/write-package-form-page').then(
        (m) => m.WritePackageFormPage,
      ),
  },
  {
    path: 'machines/:machineId/write-packages/:packageId/edit',
    data: { breadcrumb: writePackageFormEditBreadcrumb },
    loadComponent: () =>
      import('./pages/write-package-form-page/write-package-form-page').then(
        (m) => m.WritePackageFormPage,
      ),
  },
  {
    path: 'machines/:machineId/signals/new',
    data: { breadcrumb: signalFormNewBreadcrumb },
    loadComponent: () =>
      import('./pages/signal-form-page/signal-form-page').then((m) => m.SignalFormPage),
  },
  {
    path: 'machines/:machineId/signals/:signalId/edit',
    data: { breadcrumb: signalFormEditBreadcrumb },
    loadComponent: () =>
      import('./pages/signal-form-page/signal-form-page').then((m) => m.SignalFormPage),
  },
  {
    path: 'machines/:machineId/signals/:signalId/alarm-definitions/new',
    data: { breadcrumb: alarmDefinitionFormNewBreadcrumb },
    loadComponent: () =>
      import('../alarms/pages/alarm-definition-form-page/alarm-definition-form-page').then(
        (m) => m.AlarmDefinitionFormPage,
      ),
  },
  {
    path: 'machines/:machineId/signals/:signalId/alarm-definitions/:alarmDefinitionId/edit',
    data: { breadcrumb: alarmDefinitionFormEditBreadcrumb },
    loadComponent: () =>
      import('../alarms/pages/alarm-definition-form-page/alarm-definition-form-page').then(
        (m) => m.AlarmDefinitionFormPage,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'machines' },
];

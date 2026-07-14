import { Routes } from '@angular/router';

/** docs/specs/06-gestion-machines-signals.md: rutas de gestión de Machines/Signals. */
export const configRoutes: Routes = [
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

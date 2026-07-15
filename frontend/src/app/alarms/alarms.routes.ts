import { Routes } from '@angular/router';
import { alarmDetailBreadcrumb, alarmsListBreadcrumb } from './use-cases/alarms-breadcrumbs';

/** docs/specs/09-alarmas.md: rutas del panel de alarmas de la Company. */
export const alarmsRoutes: Routes = [
  {
    path: '',
    data: { breadcrumb: alarmsListBreadcrumb },
    loadComponent: () =>
      import('./pages/alarm-panel-page/alarm-panel-page').then((m) => m.AlarmPanelPage),
  },
  {
    path: ':id',
    data: { breadcrumb: alarmDetailBreadcrumb },
    loadComponent: () =>
      import('./pages/alarm-detail-page/alarm-detail-page').then((m) => m.AlarmDetailPage),
  },
];

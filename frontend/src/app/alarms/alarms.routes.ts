import { Routes } from '@angular/router';

/** docs/specs/09-alarmas.md: rutas del panel de alarmas de la Company. */
export const alarmsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/alarm-panel-page/alarm-panel-page').then((m) => m.AlarmPanelPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/alarm-detail-page/alarm-detail-page').then((m) => m.AlarmDetailPage),
  },
];

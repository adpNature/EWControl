import { Routes } from '@angular/router';
import { historyBreadcrumb } from './use-cases/history-breadcrumbs';

/** docs/specs/14-historicos-comparativas.md: pantalla única, sin sub-rutas. */
export const historyRoutes: Routes = [
  {
    path: '',
    data: { breadcrumb: historyBreadcrumb },
    loadComponent: () => import('./pages/history-page/history-page').then((m) => m.HistoryPage),
  },
];

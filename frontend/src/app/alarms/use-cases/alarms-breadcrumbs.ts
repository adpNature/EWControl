import { BreadcrumbCrumb } from '../../shared/ui/breadcrumb/breadcrumb.model';

/**
 * docs/specs/12-navegacion-shell.md: `AlarmState` no tiene un campo tipo
 * nombre, así que el tramo final es una etiqueta estática ("Detalle"), no un
 * resolver dinámico como en `config-breadcrumbs.ts`.
 */
export const alarmsListCrumb: BreadcrumbCrumb = { label: 'Alarmas', link: () => ['/alarms'] };

export const alarmsListBreadcrumb: BreadcrumbCrumb[] = [alarmsListCrumb];

export const alarmDetailBreadcrumb: BreadcrumbCrumb[] = [alarmsListCrumb, { label: 'Detalle' }];

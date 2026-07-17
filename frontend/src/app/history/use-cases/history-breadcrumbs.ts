import { BreadcrumbCrumb } from '../../shared/ui/breadcrumb/breadcrumb.model';

/** docs/specs/14-historicos-comparativas.md: pantalla única, sin rutas anidadas. */
export const historyCrumb: BreadcrumbCrumb = { label: 'Históricos', link: () => ['/history'] };

export const historyBreadcrumb: BreadcrumbCrumb[] = [historyCrumb];

import { EnvironmentInjector } from '@angular/core';
import { ParamMap } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * Resuelve la etiqueta de un tramo dinámico del breadcrumb (docs/specs/12-navegacion-shell.md)
 * a partir de los parámetros de la ruta activa — ej. el nombre real de una Machine/Signal,
 * no un id. Se ejecuta con `runInInjectionContext` para poder usar `inject()` dentro.
 */
export type BreadcrumbResolver = (
  paramMap: ParamMap,
  injector: EnvironmentInjector,
) => Observable<string>;

/**
 * Un tramo del breadcrumb. `data.breadcrumb` en una ruta hoja es un array de estos
 * (docs/specs/12-navegacion-shell.md: las rutas de `config.routes.ts` son planas,
 * no anidadas, así que no hay un `ActivatedRoute` por nivel visual).
 */
export interface BreadcrumbCrumb {
  readonly label: string | BreadcrumbResolver;
  /** Ausente => el tramo se renderiza como texto, nunca como enlace. */
  readonly link?: (paramMap: ParamMap) => string[];
}

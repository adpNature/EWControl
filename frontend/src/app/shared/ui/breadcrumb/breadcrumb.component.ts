import {
  Component,
  EnvironmentInjector,
  OnDestroy,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  ParamMap,
  Router,
  RouterLink,
} from '@angular/router';
import { Subscription, combineLatest, map, of } from 'rxjs';
import { BreadcrumbCrumb } from './breadcrumb.model';

interface ResolvedCrumb {
  readonly label: string;
  readonly link?: string[];
}

/**
 * Breadcrumb de la zona privada (docs/specs/12-navegacion-shell.md, AC5): lee
 * `data.breadcrumb` de la ruta hoja activa (un array de tramos, no un string por
 * nivel — `config.routes.ts` es plano, sin `children` anidados). Se muestra en
 * toda ruta privada que defina `data.breadcrumb`, incluidas las de listado (un
 * único tramo = la página actual, sin enlace); solo no renderiza nada si la
 * ruta activa no define `data.breadcrumb` en absoluto.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly injector = inject(EnvironmentInjector);
  private readonly navigationSubscription: Subscription;
  private resolveSubscription?: Subscription;

  readonly crumbs = signal<ResolvedCrumb[]>([]);

  constructor() {
    this.updateCrumbs();
    this.navigationSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.updateCrumbs();
      }
    });
  }

  ngOnDestroy(): void {
    this.navigationSubscription.unsubscribe();
    this.resolveSubscription?.unsubscribe();
  }

  private deepestRoute(): ActivatedRouteSnapshot {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route;
  }

  private updateCrumbs(): void {
    this.resolveSubscription?.unsubscribe();

    const route = this.deepestRoute();
    const definitions = route.data['breadcrumb'] as BreadcrumbCrumb[] | undefined;

    if (!definitions || definitions.length === 0) {
      this.crumbs.set([]);
      return;
    }

    const paramMap: ParamMap = route.paramMap;
    const isLast = (index: number) => index === definitions.length - 1;

    const resolved$ = definitions.map((crumb, index) => {
      const label = crumb.label;
      const label$ =
        typeof label === 'string'
          ? of(label)
          : runInInjectionContext(this.injector, () => label(paramMap, this.injector));

      return label$.pipe(
        map((label) => ({
          label,
          link: !isLast(index) ? crumb.link?.(paramMap) : undefined,
        })),
      );
    });

    this.resolveSubscription = combineLatest(resolved$).subscribe((crumbs) => {
      this.crumbs.set(crumbs);
    });
  }
}

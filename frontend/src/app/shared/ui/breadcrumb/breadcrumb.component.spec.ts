import { Component } from '@angular/core';
import {
  NavigationEnd,
  ParamMap,
  Router,
  Routes,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { Subject, of } from 'rxjs';
import { BreadcrumbComponent } from './breadcrumb.component';
import { BreadcrumbCrumb } from './breadcrumb.model';

@Component({ template: '' })
class BlankPage {}

function routerStub(
  breadcrumb: BreadcrumbCrumb[] | undefined,
  params: Record<string, string> = {},
) {
  const leaf: { data: Record<string, unknown>; paramMap: ParamMap; firstChild: null } = {
    data: { breadcrumb },
    paramMap: convertToParamMap(params),
    firstChild: null,
  };
  return {
    events: new Subject<unknown>(),
    routerState: { snapshot: { root: leaf } },
  };
}

describe('BreadcrumbComponent', () => {
  it('no renderiza nada si la ruta activa no define breadcrumb', async () => {
    const { container } = await render(BreadcrumbComponent, {
      providers: [{ provide: Router, useValue: routerStub(undefined) }],
    });

    expect(container.querySelector('nav')).toBeNull();
  });

  it('renderiza igualmente un trail de un solo tramo (páginas de listado), como página actual sin enlace', async () => {
    const { container } = await render(BreadcrumbComponent, {
      providers: [{ provide: Router, useValue: routerStub([{ label: 'Machines' }]) }],
    });

    expect(container.querySelector('nav')).toBeTruthy();
    const current = screen.getByText('Machines');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('renderiza un trail estático, con enlace salvo en el último tramo', async () => {
    const trail: BreadcrumbCrumb[] = [
      { label: 'Machines', link: () => ['/config/machines'] },
      { label: 'Editar' },
    ];

    await render(BreadcrumbComponent, {
      providers: [{ provide: Router, useValue: routerStub(trail) }],
    });

    // El stub de Router no implementa `createUrlTree`/`serializeUrl`, así que
    // `routerLink` no puede calcular el `href` real aquí — se verifica que el
    // primer tramo se renderiza como `<a>` (enlazable) y el último como texto
    // plano con `aria-current`; el destino exacto del enlace lo cubre
    // `config-breadcrumbs.spec.ts` sobre las funciones `link()` en sí.
    expect(screen.getByText('Machines').tagName).toBe('A');
    const current = screen.getByText('Editar');
    expect(current.tagName).toBe('SPAN');
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('resuelve labels dinámicos con los parámetros de la ruta activa', async () => {
    const trail: BreadcrumbCrumb[] = [
      { label: 'Machines', link: () => ['/config/machines'] },
      { label: (paramMap) => of(`Torno ${paramMap.get('machineId')}`) },
    ];

    await render(BreadcrumbComponent, {
      providers: [{ provide: Router, useValue: routerStub(trail, { machineId: '3' }) }],
    });

    expect(await screen.findByText('Torno 3')).toBeInTheDocument();
  });

  it('re-resuelve el trail en cada NavigationEnd', async () => {
    const stub = routerStub([{ label: 'Machines', link: () => ['/x'] }, { label: 'Uno' }]);

    await render(BreadcrumbComponent, { providers: [{ provide: Router, useValue: stub }] });
    expect(screen.getByText('Uno')).toBeInTheDocument();

    stub.routerState.snapshot.root.data['breadcrumb'] = [
      { label: 'Machines', link: () => ['/x'] },
      { label: 'Dos' },
    ];
    stub.events.next(new NavigationEnd(1, '/x', '/x'));

    expect(await screen.findByText('Dos')).toBeInTheDocument();
  });

  it('AC5: en una ruta anidada de 4 niveles muestra el trail completo con los nombres reales', async () => {
    const trail: BreadcrumbCrumb[] = [
      { label: 'Machines', link: () => ['/config/machines'] },
      {
        label: (paramMap) => of(`Torno ${paramMap.get('machineId')}`),
        link: (paramMap) => ['/config/machines', paramMap.get('machineId')!],
      },
      { label: 'Signals' },
      { label: () => of('Temperatura') },
      { label: 'Editar' },
    ];
    const routes: Routes = [
      {
        path: 'config/machines/:machineId/signals/:signalId/edit',
        data: { breadcrumb: trail },
        component: BlankPage,
      },
    ];

    const { container } = await render(BreadcrumbComponent, {
      providers: [provideRouter(routes)],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/config/machines/torno-3/signals/temp/edit');

    expect(await screen.findByText('Torno torno-3')).toBeInTheDocument();
    expect(screen.getByText('Signals')).toBeInTheDocument();
    expect(screen.getByText('Temperatura')).toBeInTheDocument();
    const current = screen.getByText('Editar');
    expect(current).toHaveAttribute('aria-current', 'page');

    // `getByRole('link', ...)` depende de que jsdom resuelva la media query de
    // colapso de tramos intermedios (`@include respond(md)`), así que se
    // verifican los `href` directamente sobre los `<a>` del DOM en vez de por rol.
    const links = [...container.querySelectorAll('a')];
    expect(links.find((a) => a.textContent === 'Machines')).toHaveAttribute(
      'href',
      '/config/machines',
    );
    expect(links.find((a) => a.textContent === 'Torno torno-3')).toHaveAttribute(
      'href',
      '/config/machines/torno-3',
    );
  });
});

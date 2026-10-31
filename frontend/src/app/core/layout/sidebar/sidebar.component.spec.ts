import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { SidebarCollapseState } from './sidebar-collapse.state';
import { SidebarComponent } from './sidebar.component';

const ROUTES = [
  { path: 'dashboard', children: [] },
  { path: 'config/machines', children: [] },
  { path: 'config/companies', children: [] },
  { path: 'config/users', children: [] },
  { path: 'alarms', children: [] },
  { path: 'history', children: [] },
  { path: 'paquetes', children: [] },
  { path: 'account/change-password', children: [] },
];

function flushIcons(httpMock: HttpTestingController) {
  httpMock.match(() => true).forEach((req) => req.flush('<svg></svg>'));
}

function createCollapseState(collapsed = false) {
  return { collapsed: () => collapsed, toggle: vi.fn() };
}

async function renderSidebar(
  role: 'AdminCliente' | 'SuperAdmin' | 'Operador' | undefined,
  collapseState = createCollapseState(),
) {
  const authState = {
    currentUser: () => (role ? { email: 'demo@ewcontrol.local', role } : null),
    logout: vi.fn().mockReturnValue(of(undefined)),
  };

  const result = await render(SidebarComponent, {
    providers: [
      { provide: AuthStateService, useValue: authState },
      { provide: SidebarCollapseState, useValue: collapseState },
      provideRouter(ROUTES),
      provideHttpClient(),
      provideHttpClientTesting(),
    ],
  });

  flushIcons(TestBed.inject(HttpTestingController));
  return { ...result, authState, collapseState };
}

describe('SidebarComponent', () => {
  it('no muestra "Companies" para un AdminCliente', async () => {
    await renderSidebar('AdminCliente');

    expect(screen.queryByRole('link', { name: 'Companies' })).not.toBeInTheDocument();
  });

  it('muestra "Companies" (enlazando a /config/companies) para un SuperAdmin', async () => {
    await renderSidebar('SuperAdmin');

    const link = screen.getByRole('link', { name: 'Companies' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/config/companies');
  });

  it('muestra "Históricos" enlazando a /history', async () => {
    await renderSidebar('AdminCliente');

    const link = screen.getByRole('link', { name: 'Históricos' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/history');
  });

  it('resalta la sección "Configuración" como activa incluso en una ruta anidada', async () => {
    const { fixture } = await renderSidebar('AdminCliente');
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/config/machines');
    fixture.detectChanges();

    expect(screen.getByRole('link', { name: /Configuración/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('el botón "Cerrar sesión" cierra sesión y navega a /login', async () => {
    const { authState } = await renderSidebar('AdminCliente');
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));

    expect(authState.logout).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('el botón de colapso invoca SidebarCollapseState.toggle()', async () => {
    const { container, collapseState } = await renderSidebar('AdminCliente');

    // El botón solo es visible en desktop (`@include respond(lg)`), oculto por
    // CSS en el viewport por defecto de jsdom — se localiza por selector en vez
    // de por rol accesible, que ignora elementos con `display: none`.
    const toggle = container.querySelector<HTMLButtonElement>('.sidebar__collapse-toggle');
    expect(toggle).toBeTruthy();
    await userEvent.click(toggle!);

    expect(collapseState.toggle).toHaveBeenCalled();
  });

  it('aplica la clase de colapsado cuando SidebarCollapseState.collapsed() es true', async () => {
    const { container } = await renderSidebar('AdminCliente', createCollapseState(true));

    expect(container.querySelector('nav')).toHaveClass('sidebar--collapsed');
    const toggle = container.querySelector('.sidebar__collapse-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Expandir navegación');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  describe('drawer móvil', () => {
    it('el botón de menú abre el drawer y mueve el foco dentro', async () => {
      const { container } = await renderSidebar('AdminCliente');
      const trigger = container.querySelector<HTMLButtonElement>('.sidebar__mobile-trigger')!;

      await userEvent.click(trigger);

      expect(container.querySelector('nav')).toHaveClass('sidebar--mobile-open');
      await waitFor(() => {
        expect(document.activeElement).toBe(container.querySelector('.sidebar__logo'));
      });
    });

    it('Escape cierra el drawer y devuelve el foco al botón que lo abrió', async () => {
      const { container } = await renderSidebar('AdminCliente');
      const trigger = container.querySelector<HTMLButtonElement>('.sidebar__mobile-trigger')!;

      await userEvent.click(trigger);
      expect(container.querySelector('nav')).toHaveClass('sidebar--mobile-open');

      await userEvent.keyboard('{Escape}');

      expect(container.querySelector('nav')).not.toHaveClass('sidebar--mobile-open');
      expect(document.activeElement).toBe(trigger);
    });

    it('un clic en el backdrop cierra el drawer', async () => {
      const { container } = await renderSidebar('AdminCliente');
      const trigger = container.querySelector<HTMLButtonElement>('.sidebar__mobile-trigger')!;
      await userEvent.click(trigger);

      const backdrop = container.querySelector<HTMLElement>('.sidebar__backdrop')!;
      await userEvent.click(backdrop);

      expect(container.querySelector('nav')).not.toHaveClass('sidebar--mobile-open');
    });

    it('Tab desde el último elemento enfocable vuelve al primero (foco atrapado)', async () => {
      const { container } = await renderSidebar('AdminCliente');
      const trigger = container.querySelector<HTMLButtonElement>('.sidebar__mobile-trigger')!;
      await userEvent.click(trigger);

      const focusable = [
        ...container.querySelectorAll<HTMLElement>('nav a[href], nav button:not([disabled])'),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      last.focus();
      await userEvent.tab();

      expect(document.activeElement).toBe(first);
    });

    it('Shift+Tab desde el primer elemento enfocable va al último (foco atrapado)', async () => {
      const { container } = await renderSidebar('AdminCliente');
      const trigger = container.querySelector<HTMLButtonElement>('.sidebar__mobile-trigger')!;
      await userEvent.click(trigger);

      const focusable = [
        ...container.querySelectorAll<HTMLElement>('nav a[href], nav button:not([disabled])'),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      first.focus();
      await userEvent.tab({ shift: true });

      expect(document.activeElement).toBe(last);
    });
  });

  it('oculta "Configuración" a un Operador y mantiene Dashboard, Alarmas, Históricos, Paquetes y Cuenta (specs 19 y 20)', async () => {
    await renderSidebar('Operador');

    expect(screen.queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Machines' })).not.toBeInTheDocument();
    for (const name of ['Dashboard', 'Alarmas', 'Históricos', 'Paquetes', 'Cuenta']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
    }
  });

  it('muestra "Paquetes" enlazando a /paquetes (docs/specs/20-paquetes-escritura-opc-ua.md)', async () => {
    await renderSidebar('AdminCliente');

    expect(screen.getByRole('link', { name: 'Paquetes' })).toHaveAttribute('href', '/paquetes');
  });

  it('muestra "Configuración" a un AdminCliente', async () => {
    await renderSidebar('AdminCliente');

    expect(screen.getByRole('link', { name: 'Configuración' })).toBeInTheDocument();
  });
});

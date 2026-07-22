import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LandingHeaderComponent } from './landing-header.component';

function flushIcons(httpMock: HttpTestingController) {
  httpMock.match(() => true).forEach((req) => req.flush('<svg></svg>'));
}

async function setup() {
  await render(LandingHeaderComponent, {
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  flushIcons(TestBed.inject(HttpTestingController));
}

describe('LandingHeaderComponent', () => {
  it('muestra el logo de la plataforma enlazando al inicio', async () => {
    await setup();

    const logo = screen.getByRole('img', { name: 'EWControl' });
    expect(logo.closest('a')).toHaveAttribute('href', '#inicio');
  });

  it('muestra los enlaces de navegación a cada sección de la landing (menú móvil abierto)', async () => {
    await setup();

    // El <nav> colapsa por CSS (`respond(md)`) fuera del viewport de escritorio, que
    // jsdom no satisface por defecto (mismo criterio que sidebar.component.spec.ts para
    // su drawer): se abre el menú para que los enlaces queden accesibles por rol.
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    expect(screen.getByRole('link', { name: 'Qué es' })).toHaveAttribute('href', '#que-es');
    expect(screen.getByRole('link', { name: 'Ventajas' })).toHaveAttribute('href', '#ventajas');
    expect(screen.getByRole('link', { name: 'Para quién es' })).toHaveAttribute(
      'href',
      '#para-quien',
    );
  });

  it('el CTA de inicio de sesión navega a /login, sin ningún enlace de registro', async () => {
    await setup();

    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/registr/i)).not.toBeInTheDocument();
  });

  it('el botón de menú móvil alterna aria-expanded al pulsarlo', async () => {
    await setup();

    const toggle = screen.getByRole('button', { name: 'Abrir menú' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  describe('scroll-to animado', () => {
    it('un clic normal previene el salto instantáneo del navegador', async () => {
      await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

      const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      screen.getByRole('link', { name: 'Qué es' }).dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('un clic con Ctrl (abrir en pestaña nueva) no se intercepta', async () => {
      await setup();
      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ctrlKey: true,
      });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      screen.getByRole('link', { name: 'Qué es' }).dispatchEvent(event);

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('cierra el menú móvil al hacer clic en un enlace de navegación', async () => {
      await setup();

      await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
      const toggle = screen.getByRole('button', { name: 'Cerrar menú' });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      await userEvent.click(screen.getByRole('link', { name: 'Ventajas' }));

      expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });
});

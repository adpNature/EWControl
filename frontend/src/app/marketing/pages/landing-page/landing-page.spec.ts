import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LandingPage } from './landing-page';

function flushIcons(httpMock: HttpTestingController) {
  httpMock.match(() => true).forEach((req) => req.flush('<svg></svg>'));
}

async function setup() {
  await render(LandingPage, {
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  flushIcons(TestBed.inject(HttpTestingController));
}

describe('LandingPage', () => {
  it('muestra un único h1 en el hero con el CTA de inicio de sesión', async () => {
    await setup();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Iniciar sesión' }).length).toBeGreaterThan(0);
  });

  it('muestra las secciones "Qué es", "Ventajas" y "Para quién es" con sus ids de scroll-to', async () => {
    await setup();

    expect(document.querySelector('#que-es')).toBeTruthy();
    expect(document.querySelector('#ventajas')).toBeTruthy();
    expect(document.querySelector('#para-quien')).toBeTruthy();
  });

  it('no muestra ningún texto o enlace de registro en toda la página', async () => {
    await setup();

    expect(screen.queryByText(/registr/i)).not.toBeInTheDocument();
  });

  it('el clic en un enlace de navegación inicia la animación de scroll (ease-in-out) hacia su sección', async () => {
    await setup();
    // El <nav> colapsa por CSS fuera del viewport de escritorio (jsdom no lo
    // satisface por defecto, mismo criterio que landing-header.component.spec.ts).
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    // Los espías se instalan después del render para no interceptar los
    // requestAnimationFrame internos de Angular/zone.js durante el arranque.
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    await userEvent.click(screen.getByRole('link', { name: 'Ventajas' }));
    rafCallbacks.forEach((callback) => callback(0));

    expect(scrollToSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

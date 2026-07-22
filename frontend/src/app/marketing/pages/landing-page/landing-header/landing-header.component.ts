import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { animateScrollTo } from './smooth-scroll';

/**
 * Cabecera sticky de la landing pública (docs/specs/17-landing-page.md). A
 * diferencia del drawer de `SidebarComponent`, el menú móvil no tapa
 * contenido ni necesita atrapar el foco: es una simple lista desplegable.
 */
@Component({
  selector: 'app-landing-header',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './landing-header.component.html',
  styleUrl: './landing-header.component.scss',
})
export class LandingHeaderComponent {
  readonly mobileOpen = signal(false);

  toggleMobile(): void {
    this.mobileOpen.update((open) => !open);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  /**
   * Scroll-to animado (`animateScrollTo`) en vez del salto instantáneo del
   * `href="#id"`. Respeta el clic modificado (abrir en pestaña nueva, etc.),
   * que no debe interceptarse.
   */
  scrollToSection(event: MouseEvent, sectionId: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    event.preventDefault();
    this.closeMobile();

    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const headerOffset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const targetY = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    animateScrollTo(targetY);
  }
}

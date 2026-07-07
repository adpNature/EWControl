import { Component, ElementRef, Input, OnChanges, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

/**
 * Carga un icono SVG por nombre desde `public/icons/<name>.svg` (Documento 12, apartado 12.5).
 * Los SVGs se descargan manualmente del set gratuito de Iconsax — nunca de un paquete npm
 * que mezcle iconos de pago — ver la comparativa documentada en ese mismo apartado.
 */
const iconCache = new Map<string, Promise<string>>();

@Component({
  selector: 'app-icon',
  standalone: true,
  template: '',
})
export class IconComponent implements OnChanges {
  /** Nombre del fichero sin extensión, ej. "alert-circle" para public/icons/alert-circle.svg. */
  @Input({ required: true }) name!: string;

  /**
   * Descripción accesible. Si se omite, el icono se marca `aria-hidden` (decorativo);
   * si se indica, se aplica como `aria-label` (Documento 12, apartado 12.5).
   */
  @Input() label?: string;

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  async ngOnChanges(): Promise<void> {
    const svg = await this.loadSvg(this.name);
    const host = this.elementRef.nativeElement as HTMLElement;
    host.innerHTML = this.sanitizer.sanitize(1 /* SecurityContext.HTML */, svg) ?? '';

    const svgEl = host.querySelector('svg');
    if (!svgEl) return;

    if (this.label) {
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', this.label);
    } else {
      svgEl.setAttribute('aria-hidden', 'true');
      svgEl.setAttribute('focusable', 'false');
    }
  }

  private loadSvg(name: string): Promise<string> {
    const cached = iconCache.get(name);
    if (cached) return cached;

    const promise = firstValueFrom(this.http.get(`icons/${name}.svg`, { responseType: 'text' }));
    iconCache.set(name, promise);
    return promise;
  }
}

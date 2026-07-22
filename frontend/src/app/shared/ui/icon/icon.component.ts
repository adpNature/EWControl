import { Component, ElementRef, Input, OnChanges, SecurityContext, inject } from '@angular/core';
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
  // `:host` es inline por defecto (elemento custom sin UA stylesheet): el SVG
  // interno queda en flujo inline y arrastra el hueco de descendente bajo la
  // línea base, dejando el host en 24x28 en vez de los 24x24 reales del SVG.
  styles: ':host { display: inline-flex; }',
})
export class IconComponent implements OnChanges {
  /** Nombre del fichero sin extensión, ej. "alert-circle" para public/icons/alert-circle.svg. */
  @Input({ required: true }) name!: string;

  /**
   * Descripción accesible. Si se omite, el icono se marca `aria-hidden` (decorativo);
   * si se indica, se aplica como `aria-label` (Documento 12, apartado 12.5).
   */
  @Input() label?: string;

  /** Ancho/alto en píxeles, sobrescribiendo el 24x24 por defecto del SVG descargado. */
  @Input() size?: number;

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  async ngOnChanges(): Promise<void> {
    let svg: string;
    try {
      svg = await this.loadSvg(this.name);
    } catch {
      // SVG todavía no descargado en public/icons/ (ver README de esa carpeta):
      // no rompe el render, el icono simplemente queda vacío hasta añadirlo.
      return;
    }

    const host = this.elementRef.nativeElement as HTMLElement;
    // `sanitize(HTML, ...)` a secas destriparía el SVG: su allowlist es de HTML,
    // no reconoce `<svg>/<path>/<defs>/<clipPath>`... Estos ficheros son estáticos
    // y curados a mano (public/icons/, Documento 12 apartado 12.5), nunca contenido
    // de usuario, así que se marcan de confianza antes de sanitizar.
    const trusted = this.sanitizer.bypassSecurityTrustHtml(svg);
    host.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, trusted) ?? '';

    const svgEl = host.querySelector('svg');
    if (!svgEl) return;

    if (this.size) {
      svgEl.setAttribute('width', String(this.size));
      svgEl.setAttribute('height', String(this.size));
    }

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
    promise.catch(() => iconCache.delete(name));
    return promise;
  }
}

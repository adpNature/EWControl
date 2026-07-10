import { Component, inject } from '@angular/core';
import type { Toast } from './toast.model';
import { ToastService } from './toast.service';

/**
 * Montado una única vez en el layout raíz (docs/12-convenciones-frontend.md,
 * apartado 12.4, "Notificaciones (Toast)"). Dos regiones `aria-live`
 * separadas (`polite`/`assertive`) en vez de alternar el atributo de una
 * única región ya montada — WAI-ARIA desaconseja cambiar dinámicamente la
 * "politeness" de una región activa.
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);

  politeToasts(): Toast[] {
    return this.toastService.toasts().filter((toast) => toast.type !== 'danger');
  }

  assertiveToasts(): Toast[] {
    return this.toastService.toasts().filter((toast) => toast.type === 'danger');
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}

import { Injectable, signal } from '@angular/core';
import { Toast, ToastRequest, ToastType } from './toast.model';

const MAX_VISIBLE_TOASTS = 3;

/** Duración de auto-dismiss por tipo (docs/12-convenciones-frontend.md, 12.4: "danger puede durar más"). */
const AUTO_DISMISS_MS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  danger: 8000,
};

let nextToastId = 0;

/**
 * Cola global de notificaciones (docs/12-convenciones-frontend.md, apartado
 * 12.4, "Notificaciones (Toast)"): máximo 3 visibles simultáneamente,
 * descartando el más antiguo; auto-dismiss por `type`, con cierre manual.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  readonly toasts = this.toastsSignal.asReadonly();

  show(request: ToastRequest): number {
    const id = nextToastId++;
    const toast: Toast = { id, ...request };

    this.toastsSignal.update((current) => {
      const next = [...current, toast];
      if (next.length <= MAX_VISIBLE_TOASTS) {
        return next;
      }
      const [oldest, ...rest] = next;
      this.clearTimer(oldest.id);
      return rest;
    });

    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), AUTO_DISMISS_MS[request.type]),
    );
    return id;
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toastsSignal.update((current) => current.filter((toast) => toast.id !== id));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}

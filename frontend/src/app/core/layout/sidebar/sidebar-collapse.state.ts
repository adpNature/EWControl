import { Injectable, inject, signal } from '@angular/core';
import { LocalStorageService } from '../../storage/local-storage.service';

const STORAGE_KEY = 'ewcontrol.sidebar.collapsed';

/**
 * Estado de colapsado/expandido de la sidebar en desktop
 * (docs/specs/12-navegacion-shell.md, AC6): se lee de `LocalStorageService` al
 * construirse y se persiste en cada `toggle()`, mismo patrón signal que
 * `config/use-cases/machines.state.ts`.
 */
@Injectable({ providedIn: 'root' })
export class SidebarCollapseState {
  private readonly storage = inject(LocalStorageService);

  private readonly collapsedSignal = signal(this.storage.getItem(STORAGE_KEY) === '1');

  readonly collapsed = this.collapsedSignal.asReadonly();

  toggle(): void {
    const next = !this.collapsedSignal();
    this.collapsedSignal.set(next);
    this.storage.setItem(STORAGE_KEY, next ? '1' : '0');
  }
}

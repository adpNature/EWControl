import { Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { canManageCompanies } from '../../../config/use-cases/config-permissions';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { SidebarCollapseState } from './sidebar-collapse.state';

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled])';

/**
 * Navegación principal de la zona privada (docs/specs/12-navegacion-shell.md).
 * Reutiliza `canManageCompanies()` de `config/use-cases/config-permissions.ts`
 * en vez de duplicar la lógica de rol. En móvil (< `md`) se comporta como un
 * drawer off-canvas con foco atrapado — comportamiento nuevo, no precedido por
 * `ConfirmDialogComponent` (que solo cubre foco-al-abrir y cierre por Escape).
 */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly collapseState = inject(SidebarCollapseState);

  @ViewChild('drawer') private readonly drawerRef?: ElementRef<HTMLElement>;

  private mobileTrigger?: HTMLElement;

  readonly currentUser = this.authState.currentUser;
  readonly collapsed = this.collapseState.collapsed;
  readonly mobileOpen = signal(false);

  showCompanies(): boolean {
    return canManageCompanies(this.currentUser()?.role);
  }

  toggleCollapsed(): void {
    this.collapseState.toggle();
  }

  openMobile(trigger: EventTarget | null): void {
    this.mobileTrigger = trigger instanceof HTMLElement ? trigger : undefined;
    this.mobileOpen.set(true);
    queueMicrotask(() => this.getFocusableElements()[0]?.focus());
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
    this.mobileTrigger?.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mobileOpen()) {
      this.closeMobile();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.mobileOpen()) return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  logout(): void {
    this.authState.logout().subscribe({
      complete: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }

  private getFocusableElements(): HTMLElement[] {
    const root = this.drawerRef?.nativeElement;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }
}

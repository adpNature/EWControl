import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';

/**
 * Placeholder trivial protegido por `authGuard`, solo para demostrar el flujo
 * de sesión end-to-end (docs/specs/05-auth-login.md) hasta que exista la spec
 * real de Dashboard (Documento 0, Fase 4) — se sustituye íntegramente entonces.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);

  readonly currentUser = this.authState.currentUser;

  logout(): void {
    this.authState.logout().subscribe({
      complete: () => this.router.navigateByUrl('/login'),
      error: () => this.router.navigateByUrl('/login'),
    });
  }
}

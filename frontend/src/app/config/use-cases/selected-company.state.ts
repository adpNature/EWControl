import { Injectable, signal } from '@angular/core';

/**
 * docs/specs/10-gestion-companies-users.md, decisión de diseño 4: qué Company
 * está operando un SuperAdmin (Documento 8, apartado 8.8, "Experiencia del
 * SuperAdmin"). Estado independiente de `CompaniesState` (lista) y de
 * `AuthStateService` (sesión) — es una selección de ámbito de UI, no de sesión.
 */
@Injectable({ providedIn: 'root' })
export class SelectedCompanyState {
  private readonly selectedCompanyIdSignal = signal<string | null>(null);

  readonly selectedCompanyId = this.selectedCompanyIdSignal.asReadonly();

  select(companyId: string): void {
    this.selectedCompanyIdSignal.set(companyId);
  }

  clear(): void {
    this.selectedCompanyIdSignal.set(null);
  }
}

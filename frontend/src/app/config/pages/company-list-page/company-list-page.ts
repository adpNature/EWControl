import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Company } from '../../entities/company.model';
import { canManageCompanies } from '../../use-cases/config-permissions';
import { CompaniesState } from '../../use-cases/companies.state';

const COLUMNS: TableColumn<Company>[] = [
  { key: 'name', header: 'Nombre' },
  {
    key: 'isActive',
    header: 'Estado',
    cell: (company) => (company.isActive ? 'Activa' : 'Inactiva'),
  },
];

/** docs/specs/10-gestion-companies-users.md: listado de Companies (solo SuperAdmin). */
@Component({
  selector: 'app-company-list-page',
  standalone: true,
  imports: [RouterLink, TableComponent, ConfirmDialogComponent],
  templateUrl: './company-list-page.html',
  styleUrl: './company-list-page.scss',
})
export class CompanyListPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly toastService = inject(ToastService);
  protected readonly companiesState = inject(CompaniesState);

  readonly columns = COLUMNS;
  readonly rowKey = (company: Company): string => company.id;
  readonly companyToDeactivate = signal<Company | null>(null);
  readonly companyToPurge = signal<Company | null>(null);

  ngOnInit(): void {
    this.companiesState.load().subscribe();
  }

  canManageCompanies(): boolean {
    return canManageCompanies(this.authState.currentUser()?.role);
  }

  editCompany(company: Company): void {
    this.router.navigate([company.id, 'edit'], { relativeTo: this.route });
  }

  confirmDeactivate(): void {
    const company = this.companyToDeactivate();
    this.companyToDeactivate.set(null);
    if (!company) {
      return;
    }
    this.companiesState.remove(company.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'Company dada de baja.' }),
      error: () =>
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido dar de baja la Company.',
        }),
    });
  }

  reactivate(company: Company): void {
    this.companiesState.reactivate(company.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'Company reactivada.' }),
      error: () =>
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido reactivar la Company.',
        }),
    });
  }

  confirmPurge(): void {
    const company = this.companyToPurge();
    this.companyToPurge.set(null);
    if (!company) {
      return;
    }
    this.companiesState.purge(company.id).subscribe({
      next: () =>
        this.toastService.show({ type: 'success', message: 'Company eliminada permanentemente.' }),
      error: () =>
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido eliminar la Company.',
        }),
    });
  }
}

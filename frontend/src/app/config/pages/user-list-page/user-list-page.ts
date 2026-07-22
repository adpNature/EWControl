import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/select/select.component';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ManagedUser } from '../../entities/user.model';
import { canManageUsers } from '../../use-cases/config-permissions';
import { CompaniesState } from '../../use-cases/companies.state';
import { SelectedCompanyState } from '../../use-cases/selected-company.state';
import { UsersState } from '../../use-cases/users.state';

const COLUMNS: TableColumn<ManagedUser>[] = [
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Rol' },
  { key: 'isActive', header: 'Estado', cell: (user) => (user.isActive ? 'Activo' : 'Inactivo') },
];

/**
 * docs/specs/10-gestion-companies-users.md: listado de Users. Un `SuperAdmin`
 * ve el switcher de Company (Documento 8, apartado 8.8); un `AdminCliente`
 * nunca lo ve y siempre opera sobre la suya.
 */
@Component({
  selector: 'app-user-list-page',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    TableComponent,
    SelectComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './user-list-page.html',
  styleUrl: './user-list-page.scss',
})
export class UserListPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly toastService = inject(ToastService);
  protected readonly companiesState = inject(CompaniesState);
  protected readonly selectedCompanyState = inject(SelectedCompanyState);
  protected readonly usersState = inject(UsersState);

  readonly columns = COLUMNS;
  readonly rowKey = (user: ManagedUser): string => user.id;
  readonly userToDeactivate = signal<ManagedUser | null>(null);
  readonly companyFilter = new FormControl('', { nonNullable: true });

  readonly companyOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Todas las Companies' },
    ...this.companiesState
      .companies()
      .map((company) => ({ value: company.id, label: company.name })),
  ]);

  ngOnInit(): void {
    if (this.isSuperAdmin()) {
      this.companiesState.load().subscribe();
    }
    this.loadUsers();
    this.companyFilter.valueChanges.subscribe((companyId) => {
      this.selectedCompanyState.select(companyId);
      this.loadUsers();
    });
  }

  isSuperAdmin(): boolean {
    return this.authState.currentUser()?.role === 'SuperAdmin';
  }

  canManageUsers(): boolean {
    return canManageUsers(this.authState.currentUser()?.role);
  }

  isSelf(user: ManagedUser): boolean {
    return user.id === this.authState.currentUser()?.id;
  }

  editUser(user: ManagedUser): void {
    this.router.navigate([user.id, 'edit'], { relativeTo: this.route });
  }

  confirmDeactivate(): void {
    const user = this.userToDeactivate();
    this.userToDeactivate.set(null);
    if (!user) {
      return;
    }
    this.usersState.remove(user.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'User dado de baja.' }),
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido dar de baja al User.' }),
    });
  }

  reactivate(user: ManagedUser): void {
    this.usersState.reactivate(user.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'User reactivado.' }),
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido reactivar al User.' }),
    });
  }

  private loadUsers(): void {
    const companyId = this.isSuperAdmin() ? this.companyFilter.value || undefined : undefined;
    this.usersState.load(companyId).subscribe();
  }
}

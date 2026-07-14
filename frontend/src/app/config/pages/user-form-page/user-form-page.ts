import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { UserRole } from '../../../auth/entities/user.model';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/select/select.component';
import { UsersApiService } from '../../adapters/users-api.service';
import { UsersState } from '../../use-cases/users.state';
import { userFormErrorMessage } from './user-form-error-message';

const ADMIN_CLIENTE_ROLE_OPTIONS: SelectOption[] = [
  { value: 'AdminCliente', label: 'AdminCliente' },
];
const SUPERADMIN_ROLE_OPTIONS: SelectOption[] = [
  ...ADMIN_CLIENTE_ROLE_OPTIONS,
  { value: 'SuperAdmin', label: 'SuperAdmin' },
];

/**
 * docs/specs/10-gestion-companies-users.md: alta y edición de User (misma
 * página, mismo patrón que `machine-form-page`). El selector de rol solo
 * ofrece `SuperAdmin` como opción si el requester ya tiene ese rol (criterio
 * de aceptación frontend 3); la contraseña solo se pide en el alta.
 */
@Component({
  selector: 'app-user-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, SelectComponent],
  templateUrl: './user-form-page.html',
  styleUrl: './user-form-page.scss',
})
export class UserFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly usersApi = inject(UsersApiService);
  private readonly usersState = inject(UsersState);

  private userId: string | null = null;
  private companyId: string | null = null;

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true }),
    role: new FormControl<UserRole>('AdminCliente', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.authState.currentUser()?.role === 'SuperAdmin'
      ? SUPERADMIN_ROLE_OPTIONS
      : ADMIN_CLIENTE_ROLE_OPTIONS,
  );

  get isEditMode(): boolean {
    return this.userId !== null;
  }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('userId');
    this.companyId = this.route.snapshot.queryParamMap.get('companyId');

    if (this.isEditMode) {
      this.form.controls.password.clearValidators();
      this.usersApi
        .get(this.userId!)
        .subscribe((user) => this.form.patchValue({ email: user.email, role: user.role }));
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    }
    this.form.controls.password.updateValueAndValidity();
  }

  emailError(): string | null {
    const control = this.form.controls.email;
    return control.touched && control.invalid ? 'El email es obligatorio.' : null;
  }

  passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'La contraseña debe tener al menos 8 caracteres, con una letra y un número.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const { email, password, role } = this.form.getRawValue();

    const request$ = this.isEditMode
      ? this.usersState.update(this.userId!, { email, role })
      : this.usersState.create({
          companyId: this.companyId ?? undefined,
          email,
          password,
          role,
        });

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/config/users']);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(userFormErrorMessage(error));
      },
    });
  }
}

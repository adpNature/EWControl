import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthApiService } from '../../adapters/auth-api.service';
import { changePasswordErrorMessage } from './change-password-error-message';

/**
 * docs/specs/10-gestion-companies-users.md: cambio de contraseña propio. No
 * usa `AuthStateService` — cambiar la contraseña no altera la sesión actual
 * (el `accessToken` en memoria sigue siendo válido hasta que expire, ≤15 min).
 */
@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly authApi = inject(AuthApiService);
  private readonly toastService = inject(ToastService);

  readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  currentPasswordError(): string | null {
    const control = this.form.controls.currentPassword;
    return control.touched && control.invalid ? 'La contraseña actual es obligatoria.' : null;
  }

  newPasswordError(): string | null {
    const control = this.form.controls.newPassword;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'La nueva contraseña debe tener al menos 8 caracteres, con una letra y un número.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const { currentPassword, newPassword } = this.form.getRawValue();

    this.authApi.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.form.reset();
        this.toastService.show({ type: 'success', message: 'Contraseña actualizada.' });
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(changePasswordErrorMessage(error));
      },
    });
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthApiService } from '../../adapters/auth-api.service';
import { resetPasswordErrorMessage } from './reset-password-error-message';

/**
 * docs/specs/10-gestion-companies-users.md: restablece la contraseña a
 * partir de un token de un solo uso recibido por email. Si el enlace ya no
 * es válido, ofrece un acceso directo para solicitar uno nuevo.
 */
@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly toastService = inject(ToastService);

  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly form = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly tokenInvalid = signal(false);

  newPasswordError(): string | null {
    const control = this.form.controls.newPassword;
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
    this.tokenInvalid.set(false);
    const { newPassword } = this.form.getRawValue();

    this.authApi.resetPassword(this.token, newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toastService.show({ type: 'success', message: 'Contraseña restablecida.' });
        this.router.navigateByUrl('/login');
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(resetPasswordErrorMessage(error));
        this.tokenInvalid.set(error.code === 'INVALID_RESET_TOKEN');
      },
    });
  }
}

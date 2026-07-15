import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { AuthApiService } from '../../adapters/auth-api.service';
import { forgotPasswordErrorMessage } from './forgot-password-error-message';

const CONFIRMATION_MESSAGE =
  'Si existe una cuenta con ese email, recibirás un enlace para recuperar tu contraseña.';

/**
 * docs/specs/10-gestion-companies-users.md: solicitud de recuperación de
 * contraseña. Muestra siempre el mismo mensaje de confirmación tras enviar
 * el formulario, exista o no la cuenta (criterio de aceptación frontend 6).
 */
@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly authApi = inject(AuthApiService);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly formError = signal<string | null>(null);
  readonly confirmationMessage = CONFIRMATION_MESSAGE;

  emailError(): string | null {
    const control = this.form.controls.email;
    return control.touched && control.invalid ? 'Introduce un email válido.' : null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const { email } = this.form.getRawValue();

    // El Backend responde 202 siempre (exista o no el email); un 429 (límite
    // de solicitudes) se muestra aparte porque no depende de si la cuenta
    // existe (criterio de aceptación frontend 7); cualquier otro error de
    // red/servidor sigue mostrando la confirmación, para no filtrar nunca la
    // existencia de la cuenta (criterio 6).
    this.authApi.forgotPassword(email).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        const message = forgotPasswordErrorMessage(error);
        if (message) {
          this.formError.set(message);
        } else {
          this.submitted.set(true);
        }
      },
    });
  }
}

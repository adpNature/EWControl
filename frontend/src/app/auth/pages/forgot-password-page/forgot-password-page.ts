import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { AuthApiService } from '../../adapters/auth-api.service';

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
    const { email } = this.form.getRawValue();

    // El Backend responde 202 siempre (exista o no el email); un error aquí
    // solo puede ser de red/servidor, no de negocio — se muestra igual la
    // confirmación para no filtrar nunca la existencia de la cuenta.
    this.authApi.forgotPassword(email).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
    });
  }
}

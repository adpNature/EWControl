import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { SignalsApiService } from '../../adapters/signals-api.service';
import { SignalSource, SignalType } from '../../entities/signal.model';
import { SignalsState } from '../../use-cases/signals.state';
import { signalFormErrorMessage } from './signal-form-error-message';

/**
 * docs/specs/06-gestion-machines-signals.md: alta y edición de Signal, con
 * selector de tipo DIRECT/FORMULA. `signalType` es inmutable tras la creación
 * (mismo criterio que el Backend, `UpdateSignalDto`), así que en edición el
 * control se deshabilita y no se reenvía en el PATCH.
 */
@Component({
  selector: 'app-signal-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './signal-form-page.html',
  styleUrl: './signal-form-page.scss',
})
export class SignalFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly signalsApi = inject(SignalsApiService);
  private readonly signalsState = inject(SignalsState);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  private signalId: string | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    signalType: new FormControl<SignalType>('DIRECT', { nonNullable: true }),
    variableName: new FormControl('', { nonNullable: true }),
    expression: new FormControl('', { nonNullable: true }),
    variables: new FormControl('', { nonNullable: true }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly variablesFieldError = signal<string | null>(null);

  get isEditMode(): boolean {
    return this.signalId !== null;
  }

  get isFormula(): boolean {
    return this.form.controls.signalType.value === 'FORMULA';
  }

  ngOnInit(): void {
    this.signalId = this.route.snapshot.paramMap.get('signalId');
    if (!this.signalId) {
      return;
    }
    this.signalsApi.get(this.machineId, this.signalId).subscribe((existing) => {
      this.form.patchValue({
        name: existing.name,
        unit: existing.unit,
        signalType: existing.signalType,
        variableName:
          'variableName' in existing.signalSource ? existing.signalSource.variableName : '',
        expression: 'expression' in existing.signalSource ? existing.signalSource.expression : '',
        variables:
          'variables' in existing.signalSource ? existing.signalSource.variables.join(', ') : '',
      });
      this.form.controls.signalType.disable();
    });
  }

  nameError(): string | null {
    const control = this.form.controls.name;
    return control.touched && control.invalid ? 'El nombre es obligatorio.' : null;
  }

  unitError(): string | null {
    const control = this.form.controls.unit;
    return control.touched && control.invalid ? 'La unidad es obligatoria.' : null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    this.variablesFieldError.set(null);

    const { name, unit, signalType, variableName, expression, variables } = this.form.getRawValue();
    const signalSource: SignalSource =
      signalType === 'FORMULA'
        ? {
            expression,
            variables: variables
              .split(',')
              .map((variable) => variable.trim())
              .filter(Boolean),
          }
        : { variableName };

    const request$ = this.signalId
      ? this.signalsState.update(this.machineId, this.signalId, { name, unit, signalSource })
      : this.signalsState.create(this.machineId, { name, unit, signalType, signalSource });

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/config/machines', this.machineId]);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        const mapping = signalFormErrorMessage(error);
        if (mapping.field === 'variables') {
          this.variablesFieldError.set(mapping.message);
        } else {
          this.formError.set(mapping.message);
        }
      },
    });
  }
}

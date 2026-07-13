import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { AlarmDefinitionsState } from '../../use-cases/alarm-definitions.state';
import { AlarmOperator, AlarmPriority } from '../../entities/alarm-definition.model';
import { alarmDefinitionFormErrorMessage } from './alarm-definition-form-error-message';

const NUMERIC_OPERATORS: readonly AlarmOperator[] = ['>', '>=', '<', '<='];
const OPERATORS: readonly AlarmOperator[] = ['>', '>=', '<', '<=', '==', '!='];
const PRIORITIES: readonly AlarmPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

/**
 * docs/specs/09-alarmas.md: alta y edición de una regla de alarma sobre una
 * Signal. `threshold` se captura como texto y se convierte según `operator`
 * (numérico para `>`,`>=`,`<`,`<=`; number/boolean/string para `==`/`!=`,
 * mismo criterio que el Backend, `OperatorThresholdValidConstraint`).
 */
@Component({
  selector: 'app-alarm-definition-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './alarm-definition-form-page.html',
  styleUrl: './alarm-definition-form-page.scss',
})
export class AlarmDefinitionFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alarmDefinitionsState = inject(AlarmDefinitionsState);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  readonly signalId = this.route.snapshot.paramMap.get('signalId')!;
  private alarmDefinitionId: string | null = null;

  readonly operators = OPERATORS;
  readonly priorities = PRIORITIES;

  readonly form = new FormGroup({
    operator: new FormControl<AlarmOperator>('>', { nonNullable: true }),
    threshold: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    priority: new FormControl<AlarmPriority>('MEDIUM', { nonNullable: true }),
    notifyByEmail: new FormControl(false, { nonNullable: true }),
    showOnDashboard: new FormControl(true, { nonNullable: true }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly thresholdFieldError = signal<string | null>(null);

  get isEditMode(): boolean {
    return this.alarmDefinitionId !== null;
  }

  get isNumericOperator(): boolean {
    return NUMERIC_OPERATORS.includes(this.form.controls.operator.value);
  }

  ngOnInit(): void {
    this.alarmDefinitionId = this.route.snapshot.paramMap.get('alarmDefinitionId');
    if (!this.alarmDefinitionId) {
      return;
    }
    const id = this.alarmDefinitionId;
    const cached = this.alarmDefinitionsState
      .definitions()
      .find((definition) => definition.id === id);
    if (cached) {
      this.patchForm(
        cached.operator,
        cached.threshold,
        cached.priority,
        cached.notifyByEmail,
        cached.showOnDashboard,
      );
      return;
    }
    this.alarmDefinitionsState.load(this.signalId).subscribe((definitions) => {
      const existing = definitions.find((definition) => definition.id === id);
      if (existing) {
        this.patchForm(
          existing.operator,
          existing.threshold,
          existing.priority,
          existing.notifyByEmail,
          existing.showOnDashboard,
        );
      }
    });
  }

  thresholdError(): string | null {
    const control = this.form.controls.threshold;
    if (!control.touched || control.valid) {
      return null;
    }
    return 'El umbral es obligatorio.';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    this.thresholdFieldError.set(null);

    const { operator, threshold, priority, notifyByEmail, showOnDashboard } =
      this.form.getRawValue();
    const parsedThreshold = this.parseThreshold(operator, threshold);
    if (parsedThreshold === undefined) {
      this.submitting.set(false);
      this.thresholdFieldError.set('El umbral debe ser un número para este operador.');
      return;
    }

    const request = {
      operator,
      threshold: parsedThreshold,
      priority,
      notifyByEmail,
      showOnDashboard,
    };

    const request$ = this.alarmDefinitionId
      ? this.alarmDefinitionsState.update(this.alarmDefinitionId, request)
      : this.alarmDefinitionsState.create(this.signalId, request);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate([
          '/config/machines',
          this.machineId,
          'signals',
          this.signalId,
          'edit',
        ]);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(alarmDefinitionFormErrorMessage(error));
      },
    });
  }

  private parseThreshold(
    operator: AlarmOperator,
    rawValue: string,
  ): number | boolean | string | undefined {
    if (NUMERIC_OPERATORS.includes(operator)) {
      const parsed = Number(rawValue);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    if (rawValue === 'true' || rawValue === 'false') {
      return rawValue === 'true';
    }
    const asNumber = Number(rawValue);
    return rawValue.trim() !== '' && !Number.isNaN(asNumber) ? asNumber : rawValue;
  }

  private patchForm(
    operator: AlarmOperator,
    threshold: number | boolean | string,
    priority: AlarmPriority,
    notifyByEmail: boolean,
    showOnDashboard: boolean,
  ): void {
    this.form.patchValue({
      operator,
      threshold: String(threshold),
      priority,
      notifyByEmail,
      showOnDashboard,
    });
  }
}

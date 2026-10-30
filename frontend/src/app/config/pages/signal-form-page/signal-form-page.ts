import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AlarmDefinition } from '../../../alarms/entities/alarm-definition.model';
import { AlarmDefinitionsState } from '../../../alarms/use-cases/alarm-definitions.state';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { SignalsApiService } from '../../adapters/signals-api.service';
import { listKnownVariableNames } from '../../entities/machine-connection.model';
import { SignalSource, SignalType } from '../../entities/signal.model';
import { SignalsState } from '../../use-cases/signals.state';
import { signalFormErrorMessage } from './signal-form-error-message';

const ALARM_DEFINITION_COLUMNS: TableColumn<AlarmDefinition>[] = [
  { key: 'operator', header: 'Operador' },
  { key: 'threshold', header: 'Umbral' },
  { key: 'priority', header: 'Prioridad' },
  { key: 'notifyByEmail', header: 'Email', cell: (d) => (d.notifyByEmail ? 'Sí' : 'No') },
  { key: 'showOnDashboard', header: 'Dashboard', cell: (d) => (d.showOnDashboard ? 'Sí' : 'No') },
  { key: 'isActive', header: 'Activa', cell: (d) => (d.isActive ? 'Sí' : 'No') },
];

/**
 * docs/specs/06-gestion-machines-signals.md: alta y edición de Signal, con
 * selector de tipo DIRECT/FORMULA. `signalType` es inmutable tras la creación
 * (mismo criterio que el Backend, `UpdateSignalDto`), así que en edición el
 * control se deshabilita y no se reenvía en el PATCH.
 */
@Component({
  selector: 'app-signal-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputComponent,
    RouterLink,
    TableComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './signal-form-page.html',
  styleUrl: './signal-form-page.scss',
})
export class SignalFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly signalsApi = inject(SignalsApiService);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly signalsState = inject(SignalsState);
  protected readonly alarmDefinitionsState = inject(AlarmDefinitionsState);
  private readonly toastService = inject(ToastService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  private signalId: string | null = null;

  readonly alarmDefinitionColumns = ALARM_DEFINITION_COLUMNS;
  readonly alarmDefinitionRowKey = (definition: AlarmDefinition): string => definition.id;
  readonly alarmDefinitionToDeactivate = signal<AlarmDefinition | null>(null);

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    unit: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    signalType: new FormControl<SignalType>('DIRECT', { nonNullable: true }),
    variableName: new FormControl('', { nonNullable: true }),
    expression: new FormControl('', { nonNullable: true }),
    variables: new FormControl('', { nonNullable: true }),
  });

  readonly knownVariables = signal<string[]>([]);
  readonly knownVariablesListId = 'signal-form-known-variables';
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly variablesFieldError = signal<string | null>(null);

  get isEditMode(): boolean {
    return this.signalId !== null;
  }

  get currentSignalId(): string | null {
    return this.signalId;
  }

  get isFormula(): boolean {
    return this.form.controls.signalType.value === 'FORMULA';
  }

  ngOnInit(): void {
    // spec 18, criterio frontend 9: sugerencias de las variables que expone la
    // Machine (semillas del Simulador o nodeMapping de OPC UA). Sin conexión, sin sugerencias.
    this.machinesApi.getConnection(this.machineId).subscribe({
      next: (connection) =>
        this.knownVariables.set(listKnownVariableNames(connection.connectionConfig)),
      error: () => this.knownVariables.set([]),
    });
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
    this.alarmDefinitionsState.load(this.signalId).subscribe();
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

  editAlarmDefinition(signalId: string, definitionId: string): void {
    this.router.navigate([
      '/config/machines',
      this.machineId,
      'signals',
      signalId,
      'alarm-definitions',
      definitionId,
      'edit',
    ]);
  }

  confirmDeactivateAlarmDefinition(): void {
    const definition = this.alarmDefinitionToDeactivate();
    this.alarmDefinitionToDeactivate.set(null);
    if (!definition) {
      return;
    }
    this.alarmDefinitionsState.deactivate(definition.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'Regla desactivada.' }),
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido desactivar la regla.' }),
    });
  }
}

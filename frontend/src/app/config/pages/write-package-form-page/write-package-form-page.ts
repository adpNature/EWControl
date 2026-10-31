import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { WritePackagesApiService } from '../../../write-packages/adapters/write-packages-api.service';
import { WritePackageItem, WriteValue } from '../../../write-packages/entities/write-package.model';
import {
  parseInputValue,
  writableVariables,
  writePackageErrorMessage,
  writeValueError,
} from '../../../write-packages/use-cases/write-package-rules';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { OpcUaNodeMapping, isOpcUaConnectionConfig } from '../../entities/machine-connection.model';

type WritableVariable = OpcUaNodeMapping & { dataType: string };

interface ItemRow {
  signalVariableName: string;
  value: WriteValue | null;
}

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, configuración: alta y edición de
 * un paquete de escritura (misma página, mismo patrón que `machine-form-page`).
 * Solo ofrece variables marcadas como escribibles y valida tipo y límites
 * antes de enviar (criterio frontend 2); el Backend revalida siempre.
 */
@Component({
  selector: 'app-write-package-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputComponent],
  templateUrl: './write-package-form-page.html',
  styleUrl: './write-package-form-page.scss',
})
export class WritePackageFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly writePackagesApi = inject(WritePackagesApiService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  private readonly packageId = this.route.snapshot.paramMap.get('packageId');

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
  });

  readonly loading = signal(true);
  readonly variables = signal<WritableVariable[]>([]);
  readonly rows = signal<ItemRow[]>([]);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  readonly rowErrors = computed(() => this.rows().map((row, index) => this.rowError(row, index)));

  get isEditMode(): boolean {
    return this.packageId !== null;
  }

  ngOnInit(): void {
    this.machinesApi.getConnection(this.machineId).subscribe({
      next: (connection) => {
        const config = connection.connectionConfig;
        this.variables.set(
          isOpcUaConnectionConfig(config) ? writableVariables(config.nodeMapping) : [],
        );
        if (!this.packageId) {
          this.loading.set(false);
          if (this.variables().length > 0) {
            this.addRow();
          }
          return;
        }
        this.writePackagesApi.get(this.machineId, this.packageId).subscribe((writePackage) => {
          this.form.patchValue({
            name: writePackage.name,
            description: writePackage.description ?? '',
          });
          this.rows.set(writePackage.items.map((item) => ({ ...item })));
          this.loading.set(false);
        });
      },
      error: () => this.loading.set(false),
    });
  }

  variableOf(row: ItemRow): WritableVariable | undefined {
    return this.variables().find(
      (variable) => variable.signalVariableName === row.signalVariableName,
    );
  }

  nameError(): string | null {
    const control = this.form.controls.name;
    return (control.touched || this.submitted()) && control.invalid
      ? 'El nombre es obligatorio.'
      : null;
  }

  addRow(): void {
    const used = new Set(this.rows().map((row) => row.signalVariableName));
    const next = this.variables().find((variable) => !used.has(variable.signalVariableName));
    this.rows.update((rows) => [
      ...rows,
      {
        signalVariableName: next?.signalVariableName ?? '',
        value: next?.dataType === 'Boolean' ? false : null,
      },
    ]);
  }

  removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((row, rowIndex) => rowIndex !== index));
  }

  selectVariable(index: number, event: Event): void {
    const signalVariableName = (event.target as HTMLSelectElement).value;
    const variable = this.variables().find((v) => v.signalVariableName === signalVariableName);
    this.updateRow(index, {
      signalVariableName,
      value: variable?.dataType === 'Boolean' ? false : null,
    });
  }

  setValue(index: number, event: Event): void {
    const row = this.rows()[index];
    const variable = this.variableOf(row);
    if (!variable) {
      return;
    }
    const raw = (event.target as HTMLInputElement | HTMLSelectElement).value;
    this.updateRow(index, { ...row, value: parseInputValue(variable.dataType, raw) });
  }

  canSubmit(): boolean {
    return (
      !this.submitting() &&
      this.rows().length > 0 &&
      this.rowErrors().every((error) => error === null)
    );
  }

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.canSubmit()) {
      return;
    }
    const { name, description } = this.form.getRawValue();
    const items: WritePackageItem[] = this.rows().map((row) => ({
      signalVariableName: row.signalVariableName,
      value: row.value as WriteValue,
    }));
    const request = { name, ...(description ? { description } : {}), items };

    this.submitting.set(true);
    this.formError.set(null);
    const request$ = this.packageId
      ? this.writePackagesApi.update(this.machineId, this.packageId, request)
      : this.writePackagesApi.create(this.machineId, request);
    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/config/machines', this.machineId]);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(writePackageErrorMessage(error));
      },
    });
  }

  private rowError(row: ItemRow, index: number): string | null {
    const variable = this.variableOf(row);
    if (!variable) {
      return 'Elige una variable escribible.';
    }
    const duplicated = this.rows().some(
      (other, otherIndex) =>
        otherIndex < index && other.signalVariableName === row.signalVariableName,
    );
    if (duplicated) {
      return 'Variable repetida en otra fila.';
    }
    return writeValueError(variable, row.value);
  }

  private updateRow(index: number, row: ItemRow): void {
    this.rows.update((rows) =>
      rows.map((current, rowIndex) => (rowIndex === index ? row : current)),
    );
  }
}

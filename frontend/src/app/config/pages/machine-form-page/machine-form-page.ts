import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { MachinesState } from '../../use-cases/machines.state';
import { machineFormErrorMessage } from './machine-form-error-message';

/** docs/specs/06-gestion-machines-signals.md: alta y edición de Machine (misma página). */
@Component({
  selector: 'app-machine-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './machine-form-page.html',
  styleUrl: './machine-form-page.scss',
})
export class MachineFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly machinesState = inject(MachinesState);

  private machineId: string | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  get isEditMode(): boolean {
    return this.machineId !== null;
  }

  ngOnInit(): void {
    this.machineId = this.route.snapshot.paramMap.get('machineId');
    if (this.machineId) {
      this.machinesApi
        .get(this.machineId)
        .subscribe((machine) => this.form.patchValue({ name: machine.name }));
    }
  }

  nameError(): string | null {
    const control = this.form.controls.name;
    return control.touched && control.invalid ? 'El nombre es obligatorio.' : null;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);
    const { name } = this.form.getRawValue();

    const request$ = this.machineId
      ? this.machinesState.update(this.machineId, { name })
      : this.machinesState.create({ name });

    request$.subscribe({
      next: (machine) => {
        this.submitting.set(false);
        this.router.navigate(['/config/machines', machine.id]);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(machineFormErrorMessage(error));
      },
    });
  }
}

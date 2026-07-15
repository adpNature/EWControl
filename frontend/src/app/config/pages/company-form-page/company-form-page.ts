import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { CompaniesApiService } from '../../adapters/companies-api.service';
import { CompaniesState } from '../../use-cases/companies.state';
import { companyFormErrorMessage } from './company-form-error-message';

/**
 * docs/specs/10-gestion-companies-users.md: alta y edición de Company (misma
 * página, mismo patrón que `machine-form-page`). Tras un alta con éxito
 * continúa directamente al alta del primer `AdminCliente` de esa Company.
 */
@Component({
  selector: 'app-company-form-page',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  templateUrl: './company-form-page.html',
  styleUrl: './company-form-page.scss',
})
export class CompanyFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companiesApi = inject(CompaniesApiService);
  private readonly companiesState = inject(CompaniesState);

  private companyId: string | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);

  get isEditMode(): boolean {
    return this.companyId !== null;
  }

  ngOnInit(): void {
    this.companyId = this.route.snapshot.paramMap.get('companyId');
    if (this.companyId) {
      this.companiesApi
        .get(this.companyId)
        .subscribe((company) => this.form.patchValue({ name: company.name }));
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

    const request$ = this.companyId
      ? this.companiesState.update(this.companyId, { name })
      : this.companiesState.create({ name });

    request$.subscribe({
      next: (company) => {
        this.submitting.set(false);
        if (this.companyId) {
          this.router.navigate(['/config/companies']);
        } else {
          this.router.navigate(['/config/users/new'], { queryParams: { companyId: company.id } });
        }
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.formError.set(companyFormErrorMessage(error));
      },
    });
  }
}

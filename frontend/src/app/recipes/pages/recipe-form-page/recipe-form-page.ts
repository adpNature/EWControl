import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ApiError } from '../../../core/http/api-error.model';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { InputComponent } from '../../../shared/ui/input/input.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipesApiService } from '../../adapters/recipes-api.service';
import { RecipeLayoutComponent } from '../../components/recipe-layout/recipe-layout.component';
import { RecipeValueFieldComponent } from '../../components/recipe-value-field/recipe-value-field.component';
import { RecipeLayout } from '../../entities/recipe-template.model';
import {
  EffectiveRecipeValue,
  Recipe,
  RecipeValue,
  RecipeValueEntry,
  RecipeValueIssue,
  RecipeVariable,
  StaleRecipeValue,
} from '../../entities/recipe.model';
import {
  MAX_RECIPE_DESCRIPTION_LENGTH,
  MAX_RECIPE_TITLE_LENGTH,
  RECIPE_CATEGORY_NAME,
  copyTitle,
  formatRecipeValue,
  initialValue,
  issueMessage,
  recipeErrorMessage,
  recipeValueError,
  staleValueMessage,
  variableLabel,
} from '../../use-cases/recipe-rules';
import { HasUnsavedChanges } from '../../use-cases/unsaved-recipe-changes.guard';
import { SELECTED_MACHINE_KEY } from '../recipes-page/recipes-page';

type ValueMap = Record<string, RecipeValue | null>;

/**
 * docs/specs/25-recetas.md, "Crear y editar" y "Duplicar": formulario con
 * título, descripción y un valor obligatorio para cada variable editable. La
 * spec 26 lo pinta según la disposición de la receta base, con los valores
 * fijos visibles en solo lectura y los valores por defecto en las recetas
 * nuevas. La misma página sirve para crear, duplicar (`?duplicar=<id>`) y
 * editar. Valida en el cliente y el Backend revalida.
 */
@Component({
  selector: 'app-recipe-form-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgTemplateOutlet,
    RouterLink,
    InputComponent,
    RecipeValueFieldComponent,
    RecipeLayoutComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './recipe-form-page.html',
  styleUrl: './recipe-form-page.scss',
})
export class RecipeFormPage implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipesApi = inject(RecipesApiService);
  private readonly toasts = inject(ToastService);
  private readonly storage = inject(LocalStorageService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  readonly recipeId = this.route.snapshot.paramMap.get('recipeId');
  private readonly duplicateFromId = this.route.snapshot.queryParamMap.get('duplicar');

  readonly categoryName = RECIPE_CATEGORY_NAME;
  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(MAX_RECIPE_TITLE_LENGTH),
      ],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_RECIPE_DESCRIPTION_LENGTH)],
    }),
  });

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  /** Variables visibles: editables y fijas visibles, en el orden de la GVL. */
  readonly variables = signal<RecipeVariable[]>([]);
  readonly layout = signal<RecipeLayout | null>(null);
  readonly hiddenCount = signal(0);
  readonly values = signal<ValueMap>({});
  readonly filter = signal('');
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly titleServerError = signal<string | null>(null);
  /** Errores por variable devueltos por el Backend, hasta que se cambie su valor. */
  readonly serverIssues = signal<Record<string, string>>({});
  readonly staleValues = signal<StaleRecipeValue[]>([]);
  readonly missingVariables = signal<string[]>([]);
  readonly ignoredValues = signal<RecipeValueEntry[]>([]);
  readonly effectiveValues = signal<EffectiveRecipeValue[] | null>(null);
  readonly conflictOpen = signal(false);

  private version = 1;
  private savedSnapshot = '';
  private saved = false;

  readonly isEditMode = this.recipeId !== null;

  /** Las que se rellenan en la receta: las fijas visibles solo se muestran. */
  readonly editableVariables = computed(() =>
    this.variables().filter((variable) => variable.mode !== 'FIXED_VISIBLE'),
  );

  readonly valueErrors = computed<Record<string, string | null>>(() => {
    const values = this.values();
    const serverIssues = this.serverIssues();
    return Object.fromEntries(
      this.editableVariables().map((variable) => [
        variable.signalVariableName,
        serverIssues[variable.signalVariableName] ??
          recipeValueError(variable, values[variable.signalVariableName] ?? null),
      ]),
    );
  });

  readonly filledCount = computed(
    () => Object.values(this.valueErrors()).filter((error) => error === null).length,
  );

  readonly visibleVariables = computed(() => {
    const text = normalize(this.filter());
    if (!text) {
      return this.variables();
    }
    return this.variables().filter((variable) =>
      normalize(
        `${variable.signalVariableName} ${variable.label ?? ''} ${variable.comment ?? ''}`,
      ).includes(text),
    );
  });

  /** Con el filtro activo se ve una lista simple; sin él, la disposición de la receta base. */
  readonly isFiltering = computed(() => normalize(this.filter()) !== '');

  ngOnInit(): void {
    const sourceId = this.recipeId ?? this.duplicateFromId;
    forkJoin({
      variableSet: this.recipesApi.variables(this.machineId),
      source: sourceId ? this.recipesApi.get(this.machineId, sourceId) : of(null),
    }).subscribe({
      next: ({ variableSet, source }) => {
        this.variables.set(variableSet.variables);
        this.layout.set(variableSet.layout ?? null);
        this.hiddenCount.set(variableSet.hiddenCount ?? 0);
        this.applySource(source);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loading.set(false);
        this.loadError.set(recipeErrorMessage(error));
      },
    });
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && !this.loading() && this.snapshot() !== this.savedSnapshot;
  }

  titleError(): string | null {
    if (this.titleServerError()) {
      return this.titleServerError();
    }
    const control = this.form.controls.title;
    if (!(control.touched || this.submitted()) || control.valid) {
      return null;
    }
    return control.hasError('maxlength')
      ? `Máximo ${MAX_RECIPE_TITLE_LENGTH} caracteres.`
      : 'El título es obligatorio.';
  }

  descriptionError(): string | null {
    const control = this.form.controls.description;
    return (control.touched || this.submitted()) && control.invalid
      ? `Máximo ${MAX_RECIPE_DESCRIPTION_LENGTH} caracteres.`
      : null;
  }

  /** El error de una variable solo se muestra tras intentar guardar (o si viene del Backend). */
  visibleError(variable: RecipeVariable): string | null {
    const error = this.valueErrors()[variable.signalVariableName] ?? null;
    return this.submitted() || this.serverIssues()[variable.signalVariableName] ? error : null;
  }

  /** Etiqueta visible de una variable por su nombre (las fijas ocultas no tienen otra que el nombre). */
  labelOf(signalVariableName: string): string {
    const variable = this.variables().find(
      (candidate) => candidate.signalVariableName === signalVariableName,
    );
    return variable ? variableLabel(variable) : signalVariableName;
  }

  /** Valor legible con los textos y la unidad de la variable, si es visible. */
  formatValue(entry: RecipeValueEntry): string {
    const variable = this.variables().find(
      (candidate) => candidate.signalVariableName === entry.signalVariableName,
    );
    return variable ? formatRecipeValue(variable, entry.value) : formatRecipeValue({}, entry.value);
  }

  valueOf(variable: RecipeVariable): RecipeValue | null {
    return this.values()[variable.signalVariableName] ?? null;
  }

  setValue(variable: RecipeVariable, value: RecipeValue | null): void {
    this.values.update((values) => ({ ...values, [variable.signalVariableName]: value }));
    this.serverIssues.update((issues) => {
      const rest = { ...issues };
      delete rest[variable.signalVariableName];
      return rest;
    });
  }

  onFilterInput(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  onTitleInput(): void {
    this.titleServerError.set(null);
  }

  staleMessage(stale: StaleRecipeValue): string {
    return staleValueMessage(stale);
  }

  submit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    this.formError.set(null);
    const hasValueErrors = Object.values(this.valueErrors()).some((error) => error !== null);
    if (this.form.invalid || this.titleServerError() || hasValueErrors) {
      this.focusFirstInvalid();
      return;
    }
    const { title, description } = this.form.getRawValue();
    const request = {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      values: this.editableVariables().map((variable) => ({
        signalVariableName: variable.signalVariableName,
        value: this.values()[variable.signalVariableName] as RecipeValue,
      })),
    };
    this.submitting.set(true);
    const request$ = this.recipeId
      ? this.recipesApi.update(this.machineId, this.recipeId, { ...request, version: this.version })
      : this.recipesApi.create(this.machineId, request);
    request$.subscribe({
      next: (recipe) => {
        this.submitting.set(false);
        this.saved = true;
        this.storage.setItem(SELECTED_MACHINE_KEY, this.machineId);
        this.toasts.show({ type: 'success', message: `Receta "${recipe.title}" guardada.` });
        this.router.navigate(['/recetas']);
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.handleSaveError(error);
      },
    });
  }

  /** «Recargar la receta»: descarta los cambios propios y carga la versión guardada. */
  reloadAfterConflict(): void {
    this.conflictOpen.set(false);
    if (!this.recipeId) {
      return;
    }
    this.recipesApi.get(this.machineId, this.recipeId).subscribe((recipe) => {
      this.submitted.set(false);
      this.serverIssues.set({});
      this.applySource(recipe);
    });
  }

  keepEditing(): void {
    this.conflictOpen.set(false);
  }

  private applySource(source: Recipe | null): void {
    const values: ValueMap = Object.fromEntries(
      this.editableVariables().map((variable) => [
        variable.signalVariableName,
        initialValue(variable),
      ]),
    );
    if (source) {
      for (const entry of source.values) {
        if (entry.signalVariableName in values) {
          values[entry.signalVariableName] = entry.value;
        }
      }
      this.form.setValue({
        title: this.isEditMode ? source.title : copyTitle(source.title),
        description: source.description ?? '',
      });
      this.staleValues.set(source.staleValues);
      this.missingVariables.set(source.missingVariables);
      this.ignoredValues.set(source.ignoredValues ?? []);
      this.effectiveValues.set(this.isEditMode ? (source.effectiveValues ?? null) : null);
      this.version = source.version;
    }
    this.values.set(values);
    this.savedSnapshot = this.snapshot();
  }

  private handleSaveError(error: ApiError): void {
    if (error.code === 'RECIPE_TITLE_TAKEN') {
      this.titleServerError.set(recipeErrorMessage(error));
      this.focusFirstInvalid();
      return;
    }
    if (error.code === 'RECIPE_MODIFIED') {
      this.conflictOpen.set(true);
      return;
    }
    if (error.code === 'INVALID_RECIPE_VALUES' && Array.isArray(error.details)) {
      const issues = error.details as RecipeValueIssue[];
      this.serverIssues.set(
        Object.fromEntries(issues.map((issue) => [issue.signalVariableName, issueMessage(issue)])),
      );
      this.focusFirstInvalid();
    }
    this.formError.set(recipeErrorMessage(error));
  }

  /** Lleva el foco al primer campo con error, quitando antes el filtro si lo ocultaba. */
  private focusFirstInvalid(): void {
    const firstInvalidVariable = this.editableVariables().find(
      (variable) => this.valueErrors()[variable.signalVariableName] !== null,
    );
    if (firstInvalidVariable && !this.visibleVariables().includes(firstInvalidVariable)) {
      this.filter.set('');
    }
    setTimeout(() => {
      const target = this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]');
      target?.focus();
    });
  }

  private snapshot(): string {
    return JSON.stringify({ form: this.form.getRawValue(), values: this.values() });
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

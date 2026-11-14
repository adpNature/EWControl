import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipeTemplateApiService } from '../../../recipes/adapters/recipe-template-api.service';
import {
  RecipeLayoutComponent,
  RecipeLayoutDevice,
} from '../../../recipes/components/recipe-layout/recipe-layout.component';
import { RecipeValueFieldComponent } from '../../../recipes/components/recipe-value-field/recipe-value-field.component';
import {
  RecipeTemplate,
  RecipeTemplateImpact,
  RecipeTemplateIssue,
  RecipeTemplateVariable,
  RecipeVariableMode,
} from '../../../recipes/entities/recipe-template.model';
import { RecipeValue, RecipeVariable } from '../../../recipes/entities/recipe.model';
import { initialValue, variableLabel } from '../../../recipes/use-cases/recipe-rules';
import {
  EditorRow,
  MODE_OPTIONS,
  TemplateErrors,
  emptyErrors,
  impactMessage,
  isVisibleMode,
  layoutErrorCount,
  mapServerIssues,
  modeCounts,
  placeVariable,
  previewVariableSet,
  removeVariable,
  staleConfigMessage,
  templateErrorMessage,
  toEditorRows,
  toTemplateRequest,
  validateTemplateDraft,
  variableErrorCount,
} from '../../../recipes/use-cases/recipe-template-rules';
import { HasUnsavedChanges } from '../../../recipes/use-cases/unsaved-recipe-changes.guard';
import { RecipeLayoutEditorComponent } from '../../components/recipe-layout-editor/recipe-layout-editor.component';
import { RecipeTemplateVariableRowComponent } from '../../components/recipe-template-variable-row/recipe-template-variable-row.component';

type Tab = 'variables' | 'layout' | 'preview';
type ModeFilter = 'ALL' | 'UNCONFIGURED' | RecipeVariableMode;

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'variables', label: 'Variables' },
  { id: 'layout', label: 'Disposición' },
  { id: 'preview', label: 'Vista previa' },
];

const DEVICES: readonly { id: RecipeLayoutDevice; label: string }[] = [
  { id: 'mobile', label: 'Móvil' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Escritorio' },
];

/**
 * docs/specs/26-receta-base.md, "Pantalla de la receta base": un administrador
 * decide qué variables aparecen en el formulario de recetas, cuáles tienen un
 * valor fijo, sus reglas y cómo se colocan, y lo comprueba en la vista previa.
 * Antes de guardar se calcula cuántas recetas quedarían incompletas.
 */
@Component({
  selector: 'app-recipe-template-page',
  standalone: true,
  imports: [
    RouterLink,
    ConfirmDialogComponent,
    RecipeTemplateVariableRowComponent,
    RecipeLayoutEditorComponent,
    RecipeLayoutComponent,
    RecipeValueFieldComponent,
  ],
  providers: [DatePipe],
  templateUrl: './recipe-template-page.html',
  styleUrl: './recipe-template-page.scss',
})
export class RecipeTemplatePage implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(RecipeTemplateApiService);
  private readonly toasts = inject(ToastService);
  private readonly datePipe = inject(DatePipe);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  readonly tabs = TABS;
  readonly devices = DEVICES;
  readonly modeOptions = MODE_OPTIONS;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly template = signal<RecipeTemplate | null>(null);
  readonly variables = signal<RecipeTemplateVariable[]>([]);
  readonly rows = signal<EditorRow[]>([]);
  readonly activeTab = signal<Tab>('variables');
  readonly filter = signal('');
  readonly modeFilter = signal<ModeFilter>('ALL');
  readonly device = signal<RecipeLayoutDevice>('desktop');
  readonly previewValues = signal<Record<string, RecipeValue | null>>({});

  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly serverErrors = signal<TemplateErrors | null>(null);
  readonly pendingImpact = signal<RecipeTemplateImpact | null>(null);
  readonly conflictOpen = signal(false);

  private savedSnapshot = '';
  private saved = false;

  readonly counts = computed(() => modeCounts(this.variables()));
  readonly unconfiguredCount = computed(
    () => this.variables().filter((variable) => variable.isUnconfigured).length,
  );

  /** Errores del cliente tras intentar guardar, o los del Backend mientras no se toque nada. */
  readonly errors = computed<TemplateErrors>(() => {
    if (this.serverErrors()) {
      return this.serverErrors()!;
    }
    return this.submitted() ? validateTemplateDraft(this.variables(), this.rows()) : emptyErrors();
  });

  readonly variableErrors = computed(() => variableErrorCount(this.errors()));
  readonly layoutErrors = computed(() => layoutErrorCount(this.errors()));

  readonly filteredVariables = computed(() => {
    const text = normalize(this.filter());
    const mode = this.modeFilter();
    return this.variables().filter((variable) => {
      if (mode === 'UNCONFIGURED' && !variable.isUnconfigured) {
        return false;
      }
      if (mode !== 'ALL' && mode !== 'UNCONFIGURED' && variable.config.mode !== mode) {
        return false;
      }
      return (
        !text ||
        normalize(
          `${variable.signalVariableName} ${variable.config.label ?? ''} ${variable.comment ?? ''}`,
        ).includes(text)
      );
    });
  });

  readonly preview = computed(() => previewVariableSet(this.variables(), this.rows()));

  readonly lastSaved = computed(() => {
    const template = this.template();
    if (!template?.updatedAt) {
      return null;
    }
    return `${this.datePipe.transform(template.updatedAt, 'short') ?? ''} · ${template.updatedByEmail ?? ''}`;
  });

  ngOnInit(): void {
    this.load();
  }

  hasUnsavedChanges(): boolean {
    return !this.saved && !this.loading() && this.snapshot() !== this.savedSnapshot;
  }

  // --- Pestañas (patrón WAI-ARIA: flechas para cambiar, Inicio/Fin) ---

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  onTabKeydown(event: KeyboardEvent): void {
    const index = TABS.findIndex((tab) => tab.id === this.activeTab());
    const moves = new Map<string, number>([
      ['ArrowRight', (index + 1) % TABS.length],
      ['ArrowLeft', (index - 1 + TABS.length) % TABS.length],
      ['Home', 0],
      ['End', TABS.length - 1],
    ]);
    const next = moves.get(event.key);
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    this.activeTab.set(TABS[next].id);
    setTimeout(() =>
      this.host.nativeElement.querySelector<HTMLElement>(`#template-tab-${TABS[next].id}`)?.focus(),
    );
  }

  tabErrorCount(tab: Tab): number {
    if (tab === 'variables') {
      return this.variableErrors();
    }
    return tab === 'layout' ? this.layoutErrors() : 0;
  }

  // --- Variables ---

  onFilterInput(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  onModeFilter(event: Event): void {
    this.modeFilter.set((event.target as HTMLSelectElement).value as ModeFilter);
  }

  dotClass(mode: RecipeVariableMode): string {
    return `template-page__dot template-page__dot--${mode.toLowerCase().replace('_', '-')}`;
  }

  /** Aplica el cambio y mantiene la disposición: la que pasa a visible se coloca al final; la que se oculta, se quita. */
  updateVariable(next: RecipeTemplateVariable): void {
    const previous = this.variables().find(
      (variable) => variable.signalVariableName === next.signalVariableName,
    );
    this.variables.update((variables) =>
      variables.map((variable) =>
        variable.signalVariableName === next.signalVariableName ? next : variable,
      ),
    );
    if (previous && isVisibleMode(previous.config.mode) !== isVisibleMode(next.config.mode)) {
      this.rows.update((rows) =>
        isVisibleMode(next.config.mode)
          ? placeVariable(rows, next.signalVariableName)
          : removeVariable(rows, next.signalVariableName),
      );
    }
    this.clearServerErrors();
  }

  errorsOf(variable: RecipeTemplateVariable) {
    return this.errors().variables[variable.signalVariableName];
  }

  // --- Disposición ---

  onRowsChange(rows: EditorRow[]): void {
    this.rows.set(rows);
    this.clearServerErrors();
  }

  // --- Vista previa ---

  selectDevice(device: RecipeLayoutDevice): void {
    this.device.set(device);
  }

  previewValueOf(variable: RecipeVariable): RecipeValue | null {
    const values = this.previewValues();
    return variable.signalVariableName in values
      ? values[variable.signalVariableName]
      : initialValue(variable);
  }

  setPreviewValue(variable: RecipeVariable, value: RecipeValue | null): void {
    this.previewValues.update((values) => ({ ...values, [variable.signalVariableName]: value }));
  }

  // --- Avisos ---

  staleMessages(): string[] {
    return (this.template()?.staleConfig ?? []).map(staleConfigMessage);
  }

  removedText(): string {
    return (this.template()?.removedVariables ?? []).join(', ');
  }

  // --- Guardar ---

  save(): void {
    this.submitted.set(true);
    this.serverErrors.set(null);
    this.formError.set(null);
    const errors = validateTemplateDraft(this.variables(), this.rows());
    if (variableErrorCount(errors) > 0 || layoutErrorCount(errors) > 0) {
      this.showFirstError(errors);
      return;
    }
    this.saving.set(true);
    this.api.impact(this.machineId, this.request()).subscribe({
      next: (impact) => {
        if (impact.recipesBecomingIncomplete > 0) {
          this.saving.set(false);
          this.pendingImpact.set(impact);
          return;
        }
        this.persist();
      },
      error: (error: ApiError) => this.handleSaveError(error),
    });
  }

  impactText(impact: RecipeTemplateImpact): string {
    return impactMessage(impact);
  }

  confirmImpact(): void {
    this.pendingImpact.set(null);
    this.saving.set(true);
    this.persist();
  }

  cancelImpact(): void {
    this.pendingImpact.set(null);
  }

  reloadAfterConflict(): void {
    this.conflictOpen.set(false);
    this.load();
  }

  keepEditing(): void {
    this.conflictOpen.set(false);
  }

  private persist(): void {
    const version = this.template()?.version ?? 0;
    this.api.save(this.machineId, { ...this.request(), version }).subscribe({
      next: (template) => {
        this.saving.set(false);
        this.applyTemplate(template);
        this.toasts.show({ type: 'success', message: 'Receta base guardada.' });
      },
      error: (error: ApiError) => this.handleSaveError(error),
    });
  }

  private handleSaveError(error: ApiError): void {
    this.saving.set(false);
    if (error.code === 'RECIPE_TEMPLATE_MODIFIED') {
      this.conflictOpen.set(true);
      return;
    }
    if (error.code === 'INVALID_RECIPE_TEMPLATE' && Array.isArray(error.details)) {
      const errors = mapServerIssues(error.details as RecipeTemplateIssue[], this.rows());
      this.serverErrors.set(errors);
      this.showFirstError(errors);
    }
    this.formError.set(templateErrorMessage(error));
  }

  /** Abre la pestaña con el primer error y lleva el foco a él (desplegando su variable si hace falta). */
  private showFirstError(errors: TemplateErrors): void {
    const tab: Tab = variableErrorCount(errors) > 0 ? 'variables' : 'layout';
    this.activeTab.set(tab);
    if (tab === 'variables') {
      this.filter.set('');
      this.modeFilter.set('ALL');
    }
    setTimeout(() => {
      const root = this.host.nativeElement;
      const target =
        root.querySelector<HTMLElement>('[aria-invalid="true"]') ??
        root.querySelector<HTMLElement>('.template-variable--invalid button[aria-expanded]') ??
        root.querySelector<HTMLElement>('.layout-editor__row--invalid');
      target?.focus();
    });
  }

  private clearServerErrors(): void {
    if (this.serverErrors()) {
      this.serverErrors.set(null);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.get(this.machineId).subscribe({
      next: (template) => {
        this.applyTemplate(template);
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loading.set(false);
        this.loadError.set(templateErrorMessage(error));
      },
    });
  }

  private applyTemplate(template: RecipeTemplate): void {
    this.template.set(template);
    this.variables.set(template.variables);
    this.rows.set(toEditorRows(template.layout));
    this.submitted.set(false);
    this.serverErrors.set(null);
    this.formError.set(null);
    this.previewValues.set({});
    this.savedSnapshot = this.snapshot();
  }

  private request() {
    return toTemplateRequest(this.variables(), this.rows());
  }

  private snapshot(): string {
    return JSON.stringify(this.request());
  }

  labelOf(variable: RecipeTemplateVariable): string {
    return variableLabel({
      signalVariableName: variable.signalVariableName,
      label: variable.config.label,
    });
  }
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

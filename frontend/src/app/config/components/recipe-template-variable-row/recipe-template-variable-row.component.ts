import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { RecipeValueFieldComponent } from '../../../recipes/components/recipe-value-field/recipe-value-field.component';
import {
  RecipeConfigField,
  RecipeOption,
  RecipeTemplateVariable,
  RecipeVariableConfig,
  RecipeVariableMode,
} from '../../../recipes/entities/recipe-template.model';
import { RecipeValue, RecipeVariable } from '../../../recipes/entities/recipe.model';
import {
  FieldErrors,
  MODE_OPTIONS,
  changeMode,
  dataTypeLabel,
  fieldApplies,
  isFixedMode,
  isVisibleMode,
  previewVariable,
} from '../../../recipes/use-cases/recipe-template-rules';

/**
 * Una variable en la pestaña «Variables» de la receta base
 * (docs/specs/26-receta-base.md): selector de modo, valor fijo cuando aplica y,
 * desplegados, solo los ajustes que aplican a su tipo y modo. Tiene estado
 * (desplegada o no) y comportamiento, así que es un componente (regla 12.4).
 * No guarda nada: emite la variable cambiada y la página decide.
 */
@Component({
  selector: 'app-recipe-template-variable-row',
  standalone: true,
  imports: [RecipeValueFieldComponent],
  templateUrl: './recipe-template-variable-row.component.html',
  styleUrl: './recipe-template-variable-row.component.scss',
})
export class RecipeTemplateVariableRowComponent {
  @Input({ required: true }) variable!: RecipeTemplateVariable;
  /** Errores de esta variable, ya decididos por la página (solo cuando deben mostrarse). */
  @Input() errors: FieldErrors | undefined;

  @Output() variableChange = new EventEmitter<RecipeTemplateVariable>();

  readonly modeOptions = MODE_OPTIONS;
  readonly expanded = signal(false);

  get name(): string {
    return this.variable.signalVariableName;
  }

  get config(): RecipeVariableConfig {
    return this.variable.config;
  }

  get typeLabel(): string {
    return dataTypeLabel(this.variable.dataType);
  }

  get isVisible(): boolean {
    return isVisibleMode(this.config.mode);
  }

  get isFixed(): boolean {
    return isFixedMode(this.config.mode);
  }

  get hasSuggestion(): boolean {
    return !!(this.variable.suggestedOptions || this.variable.suggestedBooleanLabels);
  }

  /** Hay ajustes que mostrar al desplegar (las ocultas no tienen ninguno). */
  get hasSettings(): boolean {
    return this.isVisible;
  }

  get errorCount(): number {
    return Object.keys(this.errors ?? {}).length;
  }

  get settingsErrorCount(): number {
    return Object.keys(this.errors ?? {}).filter((field) => field !== 'fixedValue').length;
  }

  get mappingText(): string | null {
    const { mappingMin, mappingMax } = this.variable;
    if (mappingMin === null && mappingMax === null) {
      return null;
    }
    return `Límites del mapeo: ${mappingMin ?? '—'} a ${mappingMax ?? '—'}.`;
  }

  applies(field: RecipeConfigField): boolean {
    return fieldApplies(field, this.variable.dataType, this.config.mode);
  }

  error(field: RecipeConfigField): string | null {
    return this.errors?.[field] ?? null;
  }

  id(part: string): string {
    return `template-${this.name}-${part}`;
  }

  describedBy(field: RecipeConfigField, hintId?: string): string | null {
    const ids = [
      ...(hintId ? [hintId] : []),
      ...(this.error(field) ? [this.id(`${field}-error`)] : []),
    ];
    return ids.length > 0 ? ids.join(' ') : null;
  }

  toggleExpanded(): void {
    this.expanded.update((value) => !value);
  }

  setMode(mode: RecipeVariableMode): void {
    if (mode !== this.config.mode) {
      this.variableChange.emit(changeMode(this.variable, mode));
    }
  }

  update(changes: Partial<RecipeVariableConfig>): void {
    this.variableChange.emit({
      ...this.variable,
      isUnconfigured: false,
      config: { ...this.config, ...changes },
    });
  }

  onText(field: 'label' | 'helpText' | 'unit', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.update({ [field]: value === '' ? null : value });
  }

  onNumber(field: 'decimals' | 'min' | 'max' | 'minLength' | 'maxLength', event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim().replace(',', '.');
    this.update({ [field]: raw === '' ? null : Number(raw) });
  }

  /** Control de valor (por defecto o fijo) con las reglas efectivas de la variable. */
  valueVariable(kind: 'default' | 'fixed'): RecipeVariable {
    const rules = previewVariable(this.variable);
    return {
      ...rules,
      mode: 'EDITABLE',
      label: kind === 'fixed' ? 'Valor fijo' : 'Valor por defecto (opcional)',
      helpText: null,
      comment: null,
      defaultValue: null,
      fixedValue: null,
    };
  }

  onDefaultValue(value: RecipeValue | null): void {
    this.update({ defaultValue: value });
  }

  onFixedValue(value: RecipeValue | null): void {
    this.update({ fixedValue: value });
  }

  // --- Textos de Sí/No ---

  onBooleanLabel(which: 'falseLabel' | 'trueLabel', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const current = this.config.booleanLabels ?? { falseLabel: '', trueLabel: '' };
    const next = { ...current, [which]: value };
    this.update({ booleanLabels: next.falseLabel || next.trueLabel ? next : null });
  }

  applySuggestedBooleanLabels(): void {
    this.update({ booleanLabels: this.variable.suggestedBooleanLabels });
  }

  // --- Opciones ---

  get options(): RecipeOption[] {
    return this.config.options ?? [];
  }

  addOption(): void {
    const values = this.options.map((option) => option.value);
    const next = values.length > 0 ? Math.max(...values) + 1 : 0;
    this.update({ options: [...this.options, { value: next, label: '' }] });
  }

  removeOption(index: number): void {
    const options = this.options.filter((option, position) => position !== index);
    this.update({ options: options.length > 0 ? options : null });
  }

  onOptionValue(index: number, event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    this.updateOption(index, { value: raw === '' ? Number.NaN : Number(raw) });
  }

  onOptionLabel(index: number, event: Event): void {
    this.updateOption(index, { label: (event.target as HTMLInputElement).value });
  }

  applySuggestedOptions(): void {
    this.update({
      options: this.variable.suggestedOptions?.map((option) => ({ ...option })) ?? null,
    });
  }

  clearOptions(): void {
    this.update({ options: null });
  }

  private updateOption(index: number, changes: Partial<RecipeOption>): void {
    this.update({
      options: this.options.map((option, position) =>
        position === index ? { ...option, ...changes } : option,
      ),
    });
  }

  suggestionText(): string {
    const labels = this.variable.suggestedBooleanLabels;
    if (labels) {
      return `«${labels.falseLabel} / ${labels.trueLabel}»`;
    }
    return (this.variable.suggestedOptions ?? []).map((option) => option.label).join(' / ');
  }
}

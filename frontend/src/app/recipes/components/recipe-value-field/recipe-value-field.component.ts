import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RecipeValue, RecipeVariable } from '../../entities/recipe.model';
import {
  formatRecipeValue,
  parseRecipeInput,
  variableHelp,
  variableLabel,
} from '../../use-cases/recipe-rules';

const INTEGER_TYPES = ['SByte', 'Byte', 'Int16', 'UInt16', 'Int32', 'UInt32'];

/**
 * Control de una variable de receta según su tipo (docs/specs/25-recetas.md,
 * "Crear y editar"; docs/specs/26-receta-base.md, "Formulario de recetas"):
 * interruptor para `Boolean` (con los textos de la receta base), desplegable si
 * tiene opciones, numérico con unidad y límites, texto para `String`, y solo
 * lectura si tiene un valor fijo visible. Es un componente y no una clase CSS
 * (regla 12.4) porque convierte lo escrito al tipo de la variable y asocia
 * ayuda y error al control (`aria-describedby`, `aria-invalid`).
 */
@Component({
  selector: 'app-recipe-value-field',
  standalone: true,
  templateUrl: './recipe-value-field.component.html',
  styleUrl: './recipe-value-field.component.scss',
})
export class RecipeValueFieldComponent {
  @Input({ required: true }) variable!: RecipeVariable;
  @Input({ required: true }) value: RecipeValue | null = null;
  /** Mensaje de error ya decidido por la página (solo se pasa cuando debe mostrarse). */
  @Input() error: string | null = null;
  /** Prefijo de los ids, para que dos formularios en la misma página no choquen (vista previa). */
  @Input() idPrefix = 'recipe-value';
  /** Oculta el nombre del PLC junto a la etiqueta (cuando ya se ve al lado, como en la receta base). */
  @Input() hideTechnicalName = false;

  @Output() valueChange = new EventEmitter<RecipeValue | null>();

  get controlId(): string {
    return `${this.idPrefix}-${this.variable.signalVariableName}`;
  }

  get helpId(): string {
    return `${this.controlId}-help`;
  }

  get errorId(): string {
    return `${this.controlId}-error`;
  }

  get label(): string {
    return variableLabel(this.variable);
  }

  /** El nombre del PLC solo se enseña aparte cuando hay una etiqueta distinta. */
  get showTechnicalName(): boolean {
    return !this.hideTechnicalName && this.label !== this.variable.signalVariableName;
  }

  get help(): string | null {
    return variableHelp(this.variable);
  }

  get isFixed(): boolean {
    return this.variable.mode === 'FIXED_VISIBLE';
  }

  get isBoolean(): boolean {
    return this.variable.dataType === 'Boolean';
  }

  get isString(): boolean {
    return this.variable.dataType === 'String';
  }

  get hasOptions(): boolean {
    return (this.variable.options?.length ?? 0) > 0;
  }

  get fixedText(): string {
    const value = this.variable.fixedValue;
    return value === null || value === undefined ? '—' : formatRecipeValue(this.variable, value);
  }

  get booleanStateText(): string {
    return formatRecipeValue(this.variable, this.value === true);
  }

  get isIntegerInput(): boolean {
    return INTEGER_TYPES.includes(this.variable.dataType) || this.variable.decimals === 0;
  }

  get step(): string | null {
    if (this.isString) {
      return null;
    }
    if (this.isIntegerInput) {
      return '1';
    }
    const decimals = this.variable.decimals;
    return decimals != null ? String(10 ** -decimals) : 'any';
  }

  get maxLength(): number | null {
    return this.isString ? (this.variable.maxLength ?? 256) : null;
  }

  get describedBy(): string | null {
    const ids = [
      ...(this.help || this.limitsText ? [this.helpId] : []),
      ...(this.error ? [this.errorId] : []),
    ];
    return ids.length > 0 ? ids.join(' ') : null;
  }

  /** Límites y unidad en una frase («Entre 0 y 500 mm.»), o `null` si no hay nada que decir. */
  get limitsText(): string | null {
    if (this.isFixed || this.hasOptions || this.isBoolean) {
      return null;
    }
    if (this.isString) {
      return this.lengthText;
    }
    const { min, max } = this.variable;
    const unit = this.variable.unit ? ` ${this.variable.unit}` : '';
    if (min !== null && max !== null) {
      return `Entre ${min} y ${max}${unit}.`;
    }
    if (min !== null) {
      return `Mínimo ${min}${unit}.`;
    }
    if (max !== null) {
      return `Máximo ${max}${unit}.`;
    }
    return unit ? `En${unit}.` : null;
  }

  private get lengthText(): string | null {
    const { minLength, maxLength } = this.variable;
    if (minLength != null && maxLength != null) {
      return `Entre ${minLength} y ${maxLength} caracteres.`;
    }
    if (minLength != null) {
      return `Mínimo ${minLength} caracteres.`;
    }
    return maxLength != null ? `Máximo ${maxLength} caracteres.` : null;
  }

  onToggle(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).checked);
  }

  onInput(event: Event): void {
    this.valueChange.emit(
      parseRecipeInput(this.variable, (event.target as HTMLInputElement).value),
    );
  }

  onSelect(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(raw === '' ? null : Number(raw));
  }
}

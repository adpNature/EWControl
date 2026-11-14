import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RecipeValue, RecipeVariable } from '../../entities/recipe.model';
import { parseRecipeInput } from '../../use-cases/recipe-rules';

/**
 * Control de una variable de receta según su tipo (docs/specs/25-recetas.md,
 * "Crear y editar"): interruptor para `Boolean`, numérico con límites para
 * enteros y reales, y texto para `String`. Es un componente y no una clase CSS
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

  @Output() valueChange = new EventEmitter<RecipeValue | null>();

  get controlId(): string {
    return `recipe-value-${this.variable.signalVariableName}`;
  }

  get helpId(): string {
    return `${this.controlId}-help`;
  }

  get errorId(): string {
    return `${this.controlId}-error`;
  }

  get isBoolean(): boolean {
    return this.variable.dataType === 'Boolean';
  }

  get isString(): boolean {
    return this.variable.dataType === 'String';
  }

  get describedBy(): string | null {
    const ids = [
      ...(this.variable.comment || this.limitsText ? [this.helpId] : []),
      ...(this.error ? [this.errorId] : []),
    ];
    return ids.length > 0 ? ids.join(' ') : null;
  }

  get limitsText(): string | null {
    const { min, max } = this.variable;
    if (min !== null && max !== null) {
      return `Entre ${min} y ${max}.`;
    }
    if (min !== null) {
      return `Mínimo ${min}.`;
    }
    return max !== null ? `Máximo ${max}.` : null;
  }

  onToggle(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).checked);
  }

  onInput(event: Event): void {
    this.valueChange.emit(
      parseRecipeInput(this.variable, (event.target as HTMLInputElement).value),
    );
  }
}

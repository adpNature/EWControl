import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextInputId = 0;

/**
 * Angular Component (no clase CSS global): tiene estado (valor, deshabilitado)
 * y comportamiento (`ControlValueAccessor` sobre Reactive Forms), ver
 * docs/12-convenciones-frontend.md, apartado 12.4. Su maquetación se apoya
 * enteramente en las clases globales de `styles/form.scss` — sin CSS propio.
 * Sin `OnPush`: `writeValue`/`setDisabledState` los invoca imperativamente el
 * directive de Reactive Forms, no un binding de `@Input`, así que `OnPush` no
 * detectaría por sí solo esos cambios sin `markForCheck()` manual.
 */
@Component({
  selector: 'app-input',
  standalone: true,
  templateUrl: './input.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  @Input({ required: true }) label!: string;
  @Input() type: 'text' | 'email' | 'password' = 'text';
  @Input() autocomplete?: string;
  @Input() errorMessage: string | null = null;

  readonly id = `app-input-${nextInputId++}`;

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.value);
  }

  handleBlur(): void {
    this.onTouched();
  }
}

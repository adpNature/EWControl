import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  value: string;
  label: string;
}

let nextSelectId = 0;

/**
 * docs/specs/10-gestion-companies-users.md, decisión de diseño 5: calco de
 * `InputComponent` (mismo `ControlValueAccessor`, misma maquetación de
 * `styles/form.scss`) para el selector de rol del formulario de User y el
 * selector de Company del SuperAdmin — mantiene la convención de que todo
 * campo de formulario es un componente `app-*`, nunca un `<select>` suelto.
 */
@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './select.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) options: SelectOption[] = [];
  @Input() errorMessage: string | null = null;

  readonly id = `app-select-${nextSelectId++}`;

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

  handleChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.onChange(this.value);
  }

  handleBlur(): void {
    this.onTouched();
  }
}
